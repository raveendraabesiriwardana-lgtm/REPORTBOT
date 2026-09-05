// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Import routes
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const reportRoutes = require('./routes/reports');

// Import models
const { User, Bot, Report, Transaction } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Session config
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI
    })
}));

// ============ MONGODB CONNECTION ============
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ============ EMAIL TRANSPORTER ============
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ============ HELPER FUNCTIONS ============

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

// Generate referral link
function generateReferralLink(req, userId) {
    const baseUrl = process.env.WEBSITE_URL || `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/register?ref=${userId}`;
}

// Send verification email
async function sendVerificationEmail(email, code) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: '🔐 WhatsApp Report Bot - Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #4CAF50; text-align: center;">WhatsApp Report Bot</h2>
                    <p style="font-size: 16px; color: #333;">Hello!</p>
                    <p style="font-size: 16px; color: #333;">Your verification code is:</p>
                    <div style="text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0;">
                        <h1 style="font-size: 36px; letter-spacing: 10px; color: #4CAF50;">${code}</h1>
                    </div>
                    <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
                    <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        return false;
    }
}

// ============ AUTH ROUTES ============

// Sign Up
app.post('/api/signup', async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        
        // Validate input
        if (!name || !phone || !email) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { phone }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                error: 'User already exists with this email or phone' 
            });
        }

        // Generate verification code
        const code = generateCode();
        const referralLink = generateReferralLink(req, null);
        
        // Create user
        const user = new User({
            name,
            phone,
            email,
            verificationCode: code,
            referralLink: `${referralLink}&new=${Date.now()}`
        });
        
        await user.save();

        // Send verification email
        await sendVerificationEmail(email, code);

        res.json({ 
            success: true, 
            message: 'Verification code sent to your email',
            userId: user._id 
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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        user.isVerified = true;
        user.verificationCode = null;
        await user.save();

        // Generate JWT
        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                coins: user.coins,
                referralLink: user.referralLink,
                pairedBot: user.pairedBot
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

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.isVerified) {
            // Send new verification code
            const code = generateCode();
            user.verificationCode = code;
            await user.save();

            await sendVerificationEmail(email, code);

            return res.json({
                requiresVerification: true,
                userId: user._id,
                message: 'Verification code sent to your email'
            });
        }

        // Generate JWT
        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                coins: user.coins,
                referralLink: user.referralLink,
                pairedBot: user.pairedBot
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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const code = generateCode();
        user.verificationCode = code;
        await user.save();

        await sendVerificationEmail(user.email, code);

        res.json({
            success: true,
            message: 'New verification code sent to your email'
        });
        
    } catch (error) {
        console.error('Resend code error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ USE ROUTES ============
app.use('/api/auth', authRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/reports', reportRoutes);

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
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
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
});

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGINT', async () => {
    console.log('\n⚠️ Gracefully shutting down...');
    await mongoose.connection.close();
    process.exit(0);
});

module.exports = app;
