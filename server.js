// server.js - Main Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const Database = require('./database');
const OTPManager = require('./utils/otp');
const ChannelSender = require('./utils/whatsapp-channel');

// Import Telegram Bot
const TelegramBot = require('./telegram-bot');
const telegramBot = new TelegramBot();

const app = express();
const PORT = process.env.PORT || 3000;

// Create folders
const sessionDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

const sessionStoreDir = path.join(sessionDir, 'sessions');
if (!fs.existsSync(sessionStoreDir)) {
    fs.mkdirSync(sessionStoreDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Session config
app.use(session({
    store: new FileStore({
        path: sessionStoreDir,
        ttl: 86400,
        retries: 0,
        reapInterval: 3600
    }),
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 86400000
    }
}));

// Helper functions
function generateToken(userId) {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'default_secret',
        { expiresIn: '7d' }
    );
}

// ============ AUTH ROUTES ============

// Sign Up with OTP
app.post('/api/signup', async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        
        if (!name || !phone || !email) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user exists
        const users = await Database.getUsers();
        const existingUser = users.find(u => 
            u.phone === phone || u.email === email
        );
        
        if (existingUser) {
            return res.status(400).json({ 
                error: 'User already exists with this email or phone' 
            });
        }

        // Create user (unverified)
        const user = await Database.createUser({
            name,
            phone,
            email,
            isVerified: false
        });

        // Generate OTP
        const code = OTPManager.createOTP(user.id);
        
        // Send OTP to WhatsApp Channels
        const emailResult = await ChannelSender.sendEmailOTP(email, code);
        const phoneResult = await ChannelSender.sendPhoneOTP(phone, code);

        // Log OTP
        await Database.logOTP({
            userId: user.id,
            type: 'SIGNUP',
            email: email,
            phone: phone,
            code: code,
            sent: emailResult.success && phoneResult.success
        });

        res.json({ 
            success: true, 
            message: 'OTP sent to WhatsApp Channels',
            userId: user.id,
            channels: {
                email: emailResult.success ? '✅' : '❌',
                phone: phoneResult.success ? '✅' : '❌'
            }
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { userId, code } = req.body;
        
        if (!userId || !code) {
            return res.status(400).json({ error: 'User ID and code are required' });
        }

        const user = await Database.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'Account already verified' });
        }

        // Verify OTP
        const result = OTPManager.verifyOTP(userId, code);
        
        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        // Update user
        await Database.updateUser(userId, { 
            isVerified: true,
            coins: parseInt(process.env.WELCOME_COINS) || 10
        });

        // Generate JWT
        const token = generateToken(userId);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                coins: parseInt(process.env.WELCOME_COINS) || 10,
                pairedBot: false
            }
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// Resend OTP
app.post('/api/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const user = await Database.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if can resend
        if (!OTPManager.canResend(userId)) {
            const waitTime = OTPManager.getResendWaitTime(userId);
            return res.status(400).json({ 
                error: `Please wait ${Math.ceil(waitTime / 1000)} seconds before requesting a new OTP` 
            });
        }

        // Generate new OTP
        const code = OTPManager.createOTP(userId);
        
        // Send OTP to channels
        const emailResult = await ChannelSender.sendEmailOTP(user.email, code);
        const phoneResult = await ChannelSender.sendPhoneOTP(user.phone, code);

        res.json({
            success: true,
            message: 'New OTP sent to WhatsApp Channels',
            channels: {
                email: emailResult.success ? '✅' : '❌',
                phone: phoneResult.success ? '✅' : '❌'
            }
        });
        
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Failed to resend OTP' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, phone } = req.body;
        
        if (!email && !phone) {
            return res.status(400).json({ error: 'Email or phone is required' });
        }

        let user = null;
        if (email) {
            user = await Database.findUserByEmail(email);
        } else if (phone) {
            user = await Database.findUserByPhone(phone);
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.isVerified) {
            // Send OTP
            const code = OTPManager.createOTP(user.id);
            await ChannelSender.sendEmailOTP(user.email, code);
            await ChannelSender.sendPhoneOTP(user.phone, code);
            
            return res.json({
                requiresVerification: true,
                userId: user.id,
                message: 'OTP sent to WhatsApp Channels'
            });
        }

        // Update last login
        await Database.updateUser(user.id, { 
            lastLogin: new Date().toISOString() 
        });

        const token = generateToken(user.id);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                coins: user.coins || 0,
                pairedBot: user.pairedBot || false
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Get OTP Status
app.get('/api/otp-status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const status = OTPManager.getOTPStatus(userId);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ REPORT ROUTES ============

// Send Report
app.post('/api/report', async (req, res) => {
    try {
        const { userId, targetNumber } = req.body;
        
        if (!userId || !targetNumber) {
            return res.status(400).json({ error: 'User ID and target number are required' });
        }

        const user = await Database.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check coins
        const reportCost = parseInt(process.env.REPORT_COST) || 10;
        if (user.coins < reportCost) {
            return res.status(400).json({ 
                error: `Insufficient coins! Need ${reportCost} coins, have ${user.coins}` 
            });
        }

        // Deduct coins
        const newCoins = user.coins - reportCost;
        await Database.updateUser(userId, { coins: newCoins });

        // Create report
        const report = await Database.createReport({
            reporterId: userId,
            targetNumber: targetNumber,
            status: 'pending'
        });

        // Record transaction
        await Database.createTransaction({
            userId: userId,
            type: 'spend',
            amount: reportCost,
            description: `Report on ${targetNumber}`
        });

        // Get all active bots
        const bots = await Database.getBots();
        const activeBots = bots.filter(b => b.status === 'connected');
        
        // Send report to all active bots
        const reportMessage = `📨 Report: ${targetNumber} from ${user.phone}`;
        for (const bot of activeBots) {
            try {
                // Send to bot's WhatsApp
                // This will be handled by bot.js
                console.log(`📨 Sending report to bot ${bot.id}`);
            } catch (error) {
                console.error(`❌ Failed to send to bot ${bot.id}:`, error.message);
            }
        }

        res.json({
            success: true,
            message: `Report sent for ${targetNumber}`,
            remainingCoins: newCoins,
            activeBots: activeBots.length
        });

    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Failed to send report' });
    }
});

// Get Reports
app.get('/api/reports/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const reports = await Database.getUserReports(userId);
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ BOT ROUTES ============

// Pair Bot
app.post('/api/pair-bot', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const user = await Database.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if bot already exists
        const existingBot = await Database.findBot(userId);
        if (existingBot && existingBot.status === 'connected') {
            return res.status(400).json({ error: 'Bot already paired' });
        }

        // Create bot
        const bot = await Database.createBot({
            userId: userId,
            sessionId: `bot-${userId}`,
            status: 'connecting'
        });

        await Database.updateUser(userId, { pairedBot: true });

        // Initialize WhatsApp bot
        const WhatsAppBot = require('./bot');
        const whatsappBot = new WhatsAppBot(userId);
        await whatsappBot.initialize();

        res.json({ 
            success: true, 
            message: 'Bot pairing initiated',
            botId: bot.id
        });

    } catch (error) {
        console.error('Bot pairing error:', error);
        res.status(500).json({ error: 'Failed to pair bot' });
    }
});

// Get Bot Stats
app.get('/api/bot-stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await Database.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const bot = await Database.findBot(userId);
        if (!bot) {
            return res.json({ paired: false });
        }

        const reports = await Database.getUserReports(userId);
        const bots = await Database.getBots();
        const activeBots = bots.filter(b => b.status === 'connected');

        res.json({
            paired: true,
            botId: bot.id,
            status: bot.status,
            totalReports: reports.length,
            activeBots: activeBots.length,
            coins: user.coins || 0
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ HEALTH ============
app.get('/api/health', async (req, res) => {
    const stats = await Database.getStats();
    res.json({
        status: 'OK',
        uptime: process.uptime(),
        stats
    });
});

// ============ ROOT ============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ============ START SERVER ============
async function startServer() {
    try {
        // Start Telegram Bot
        await telegramBot.start();
        
        // Start Express server
        app.listen(PORT, async () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 URL: http://localhost:${PORT}`);
            
            // Test channel connections
            await ChannelSender.testConnection();
            
            const stats = await Database.getStats();
            console.log(`📊 Database Stats:`, stats);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();

module.exports = app;
