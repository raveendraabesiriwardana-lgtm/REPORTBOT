// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Import Database
const Database = require('./database');

// Import Email System
const { 
    sendVerificationCode, 
    sendWelcomeEmail, 
    initEmailSystem 
} = require('./utils/email');

// Import routes
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const reportRoutes = require('./routes/reports');

// ============ CREATE APP ============
const app = express();
const PORT = process.env.PORT || 3000;

// ============ INITIALIZE EMAIL SYSTEM ============
initEmailSystem();

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
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(userId) {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'default_secret',
        { expiresIn: '7d' }
    );
}

// ============ AUTH ROUTES ============

// Sign Up
app.post('/api/signup', async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        
        if (!name || !phone || !email) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if user exists
        const users = await Database.getUsers();
        const userExists = users.find(u => u.email === email || u.phone === phone);
        
        if (userExists) {
            return res.status(400).json({ 
                error: 'User already exists with this email or phone' 
            });
        }

        // Generate verification code
        const code = generateCode();
        
        // Create user
        const user = await Database.createUser({
            name,
            phone,
            email,
            verificationCode: code,
            verificationCodeExpiry: Date.now() + 600000, // 10 minutes
            isVerified: false,
            coins: 10, // Welcome bonus
            pairedBot: false
        });

        // Send verification email with retry
        const emailResult = await sendVerificationCode(email, code);
        
        if (!emailResult.success) {
            // If email fails, we still create account but show warning
            console.log('⚠️ Account created but email sending failed');
        }

        res.json({ 
            success: true, 
            message: emailResult.success ? 'Verification code sent to your email' : 'Account created. Please check email or contact support.',
            userId: user.id,
            emailSent: emailResult.success
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
});

// Verify Code
app.post('/api/verify', async (req, res) => {
    try {
        const { userId, code } = req.body;
        
        if (!userId || !code) {
            return res.status(400).json({ error: 'User ID and code are required' });
        }

        const user = await Database.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if code expired
        if (user.verificationCodeExpiry && Date.now() > user.verificationCodeExpiry) {
            return res.status(400).json({ 
                error: 'Verification code has expired. Please request a new one.' 
            });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Update user
        const updatedUser = await Database.updateUser(userId, {
            isVerified: true,
            verificationCode: null,
            verificationCodeExpiry: null
        });

        // Send welcome email
        await sendWelcomeEmail(user.email, user.name);

        // Generate JWT
        const token = generateToken(userId);

        res.json({
            success: true,
            token,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                coins: updatedUser.coins || 0,
                pairedBot: updatedUser.pairedBot || false
            }
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Failed to verify account. Please try again.' });
    }
});

// Resend verification code
app.post('/api/resend-code', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const user = await Database.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'Account already verified' });
        }

        // Generate new code
        const code = generateCode();
        await Database.updateUser(userId, {
            verificationCode: code,
            verificationCodeExpiry: Date.now() + 600000 // 10 minutes
        });

        // Send email
        const emailResult = await sendVerificationCode(user.email, code);

        res.json({
            success: true,
            message: emailResult.success ? 'New verification code sent to your email' : 'Failed to send email. Please try again later.',
            emailSent: emailResult.success
        });
        
    } catch (error) {
        console.error('Resend code error:', error);
        res.status(500).json({ error: 'Failed to resend code. Please try again.' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await Database.findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.isVerified) {
            // Send new verification code
            const code = generateCode();
            await Database.updateUser(user.id, {
                verificationCode: code,
                verificationCodeExpiry: Date.now() + 600000
            });

            await sendVerificationCode(email, code);

            return res.json({
                requiresVerification: true,
                userId: user.id,
                message: 'Verification code sent to your email'
            });
        }

        // Generate JWT
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
        res.status(500).json({ error: 'Failed to login. Please try again.' });
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

        const existingBot = await Database.findBot(userId);
        if (existingBot && existingBot.status === 'connected') {
            return res.status(400).json({ error: 'Bot already paired' });
        }

        const bot = await Database.createBot({
            userId: userId,
            sessionId: `bot-${userId}`,
            status: 'connecting',
            totalReports: 0,
            activeUsers: 0
        });

        await Database.updateUser(userId, { pairedBot: true });

        const WhatsAppBot = require('./bot');
        const whatsappBot = new WhatsAppBot(userId);
        await whatsappBot.initialize();

        res.json({ 
            success: true, 
            message: 'Bot pairing initiated. Scan QR code with WhatsApp.',
            botId: bot.id
        });

    } catch (error) {
        console.error('Bot pairing error:', error);
        res.status(500).json({ error: 'Failed to pair bot. Please try again.' });
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

        const userReports = await Database.getUserReports(userId);
        const allBots = await Database.getBots();
        const activeBots = allBots.filter(b => b.status === 'connected');

        res.json({
            paired: true,
            botId: bot.id,
            status: bot.status,
            totalReports: userReports.length,
            activeUsers: activeBots.length,
            userCoins: user.coins || 0
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get All Reports
app.get('/api/reports/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const reports = await Database.getUserReports(userId);

        res.json({ 
            success: true,
            reports,
            count: reports.length 
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ USE ROUTES ============
app.use('/api/auth', authRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/reports', reportRoutes);

// ============ HEALTH CHECK ============
app.get('/api/health', async (req, res) => {
    const stats = await Database.getStats();
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        stats
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
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📁 Session folder: ${sessionDir}`);
    
    const stats = await Database.getStats();
    console.log(`📊 Database Stats:`, stats);
});

module.exports = app;
