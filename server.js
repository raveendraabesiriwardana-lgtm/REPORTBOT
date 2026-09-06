// server.js - MongoDB එක remove කරන්න
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Import Database
const Database = require('./database');

// Import routes
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Create sessions folder
const sessionDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
    console.log('📁 Sessions folder created');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Session config (without MongoDB)
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generate verification code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate JWT token
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

        // Check if user exists
        const existingUser = await Database.findUser({ 
            $or: [{ email }, { phone }] 
        });
        
        // Simple check
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
            isVerified: false,
            coins: 0,
            pairedBot: false
        });

        // Send verification email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verification Code',
            text: `Your verification code is: ${code}`
        });

        res.json({ 
            success: true, 
            message: 'Verification code sent to your email',
            userId: user.id 
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: error.message });
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

        if (user.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Update user
        const updatedUser = await Database.updateUser(userId, {
            isVerified: true,
            verificationCode: null
        });

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
        res.status(500).json({ error: error.message });
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
            await Database.updateUser(user.id, { verificationCode: code });

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Verification Code',
                text: `Your verification code is: ${code}`
            });

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
        res.status(500).json({ error: error.message });
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

        const code = generateCode();
        await Database.updateUser(userId, { verificationCode: code });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Verification Code',
            text: `Your verification code is: ${code}`
        });

        res.json({
            success: true,
            message: 'New verification code sent to your email'
        });
        
    } catch (error) {
        console.error('Resend code error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user profile
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
            createdAt: user.createdAt
        });
        
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

        // Check if user already has a bot
        const existingBot = await Database.findBot(userId);
        if (existingBot && existingBot.status === 'connected') {
            return res.status(400).json({ error: 'Bot already paired' });
        }

        // Create bot record
        const bot = await Database.createBot({
            userId: userId,
            sessionId: `bot-${userId}`,
            status: 'connecting',
            totalReports: 0,
            activeUsers: 0
        });

        // Update user
        await Database.updateUser(userId, { pairedBot: true });

        // Initialize WhatsApp bot (from bot.js)
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
        res.status(500).json({ error: error.message });
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
    
    // Show database stats
    const stats = await Database.getStats();
    console.log(`📊 Database Stats:`, stats);
});

module.exports = app;
