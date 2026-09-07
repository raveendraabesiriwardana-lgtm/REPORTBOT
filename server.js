// server.js - Full Complete Version
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Import Database
const Database = require('./database');

// Import OTP Manager
const OTPManager = require('./utils/otp');

// Import WhatsApp Channel Sender
const ChannelSender = require('./utils/whatsapp-channel');

// Import Telegram Bot
const TelegramBot = require('./telegram-bot');
const telegramBot = new TelegramBot();

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CREATE FOLDERS ============
const sessionDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
    console.log('📁 Sessions folder created');
}

const sessionStoreDir = path.join(sessionDir, 'sessions');
if (!fs.existsSync(sessionStoreDir)) {
    fs.mkdirSync(sessionStoreDir, { recursive: true });
}

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// ============ SESSION CONFIG ============
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

// ============ HELPER FUNCTIONS ============
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

        // Validate phone
        const phoneRegex = /^\+?[0-9]{10,15}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
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

// Get User Profile
app.get('/api/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await Database.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            coins: user.coins || 0,
            pairedBot: user.pairedBot || false,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        });
        
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

        res.json({
            success: true,
            message: `Report sent for ${targetNumber}`,
            remainingCoins: newCoins,
            activeBots: activeBots.length,
            reportId: report.id
        });

    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Failed to send report' });
    }
});

// Get User Reports
app.get('/api/reports/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const reports = await Database.getUserReports(userId);
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Report Stats
app.get('/api/reports/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const reports = await Database.getUserReports(userId);
        
        const stats = {
            total: reports.length,
            pending: reports.filter(r => r.status === 'pending').length,
            completed: reports.filter(r => r.status === 'completed').length,
            failed: reports.filter(r => r.status === 'failed').length
        };
        
        res.json({ success: true, stats });
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
        try {
            const WhatsAppBot = require('./bot');
            const whatsappBot = new WhatsAppBot(userId);
            await whatsappBot.initialize();
        } catch (botError) {
            console.error('Bot initialization error:', botError);
            // Don't fail, just warn
        }

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
            return res.json({ 
                paired: false,
                message: 'Bot not paired' 
            });
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

// Disconnect Bot
app.post('/api/disconnect-bot', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const bot = await Database.findBot(userId);
        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        await Database.updateBot(bot.id, { status: 'disconnected' });
        await Database.updateUser(userId, { pairedBot: false });

        res.json({
            success: true,
            message: 'Bot disconnected successfully'
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ TRANSACTION ROUTES ============

// Get User Transactions
app.get('/api/transactions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const transactions = await Database.getUserTransactions(userId);
        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ HEALTH CHECK ============
app.get('/api/health', async (req, res) => {
    const stats = await Database.getStats();
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        stats,
        telegram: {
            running: telegramBot.isRunning,
            channelEmail: process.env.CHANNEL_EMAIL || 'Not set',
            channelPhone: process.env.CHANNEL_PHONE || 'Not set'
        }
    });
});

// ============ ROOT ROUTE ============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============ 404 HANDLER ============
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ============ START SERVER ============
async function startServer() {
    try {
        console.log('🚀 Starting server...');
        
        // Start Telegram Bot
        console.log('🤖 Initializing Telegram Bot...');
        await telegramBot.start();
        
        // Wait for bot to initialize
        if (telegramBot.isRunning) {
            console.log('✅ Telegram Bot is ready');
        } else {
            console.log('⚠️ Telegram Bot failed to start - continuing without it');
        }
        
        // Start Express server
        app.listen(PORT, async () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 URL: http://localhost:${PORT}`);
            console.log(`📁 Session folder: ${sessionDir}`);
            
            const stats = await Database.getStats();
            console.log(`📊 Database Stats:`, stats);
            
            // Test channel connections if bot is running
            if (telegramBot.isRunning) {
                console.log('📱 Testing WhatsApp Channels...');
                try {
                    const testMessage = `
🧪 <b>Test Message</b>
✅ Channel is working!
📅 ${new Date().toISOString()}
                    `;
                    await telegramBot.sendMessageToChannel(
                        process.env.CHANNEL_EMAIL,
                        testMessage
                    );
                    console.log('✅ Channel test completed');
                } catch (error) {
                    console.log('⚠️ Channel test failed:', error.message);
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        
        // Still start Express even if Telegram fails
        app.listen(PORT, async () => {
            console.log(`🚀 Server running on port ${PORT} (without Telegram)`);
            console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 URL: http://localhost:${PORT}`);
        });
    }
}

// Start the server
startServer();

module.exports = app;
