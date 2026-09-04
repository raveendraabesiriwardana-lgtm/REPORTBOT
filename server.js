require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Session config
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI
    })
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Database Models
const UserSchema = new mongoose.Schema({
    name: String,
    phone: String,
    email: { type: String, unique: true },
    password: String,
    isVerified: { type: Boolean, default: false },
    verificationCode: String,
    coins: { type: Number, default: 0 },
    referralLink: String,
    pairedBot: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const ReportSchema = new mongoose.Schema({
    reportedNumber: String,
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    botId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot' },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const BotSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientId: String,
    status: { type: String, default: 'disconnected' },
    totalReports: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Report = mongoose.model('Report', ReportSchema);
const Bot = mongoose.model('Bot', BotSchema);

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

// Generate unique referral link
function generateReferralLink(userId) {
    return `${req.protocol}://${req.get('host')}/register?ref=${userId}`;
}

// ============ AUTH ROUTES ============

// Sign Up
app.post('/api/signup', async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Generate verification code
        const code = generateCode();
        
        // Create user
        const user = new User({
            name,
            phone,
            email,
            verificationCode: code
        });
        
        await user.save();

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
            userId: user._id 
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify Code
app.post('/api/verify', async (req, res) => {
    try {
        const { userId, code } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid code' });
        }

        user.isVerified = true;
        user.verificationCode = null;
        await user.save();

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                coins: user.coins
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.isVerified) {
            // Send new verification code
            const code = generateCode();
            user.verificationCode = code;
            await user.save();

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Verification Code',
                text: `Your verification code is: ${code}`
            });

            return res.json({
                requiresVerification: true,
                userId: user._id,
                message: 'Verification code sent'
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                coins: user.coins,
                referralLink: user.referralLink
            }
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
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Check if user already has a bot
        const existingBot = await Bot.findOne({ userId });
        if (existingBot) {
            return res.status(400).json({ error: 'Bot already paired' });
        }

        // Initialize WhatsApp client
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `bot-${userId}`
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox']
            }
        });

        client.on('qr', (qr) => {
            QRCode.generate(qr, { small: true });
            console.log('QR Code generated. Scan with WhatsApp.');
        });

        client.on('ready', async () => {
            console.log('WhatsApp Bot is ready!');
            
            // Save bot to database
            const bot = new Bot({
                userId: userId,
                clientId: `bot-${userId}`,
                status: 'connected'
            });
            await bot.save();

            user.pairedBot = true;
            await user.save();

            // Handle messages
            client.on('message', async (message) => {
                // Check for .report command
                if (message.body.startsWith('.report')) {
                    const parts = message.body.split(' ');
                    if (parts.length < 2) {
                        await message.reply('Usage: .report <phone_number>');
                        return;
                    }

                    const targetNumber = parts[1];
                    
                    // Check if user has enough coins
                    if (user.coins < 10) {
                        await message.reply(`❌ Insufficient coins! You need 10 coins. You have ${user.coins} coins.`);
                        return;
                    }

                    // Process report
                    const report = new Report({
                        reportedNumber: targetNumber,
                        reporterId: user._id,
                        botId: bot._id
                    });
                    await report.save();

                    // Deduct coins
                    user.coins -= 10;
                    await user.save();

                    // Get all users with active bots
                    const allBots = await Bot.find({ status: 'connected' });
                    const activeUsers = allBots.length;

                    // Send report to all bots
                    await message.reply(`✅ Report sent for ${targetNumber}! 
                    📊 Active Bots: ${activeUsers}
                    🪙 Remaining Coins: ${user.coins}`);

                    // Actually send to all bots (this is simplified)
                    // In production, you'd need to implement message broadcasting
                }
            });
        });

        client.on('authenticated', () => {
            console.log('Authenticated successfully');
        });

        client.initialize();

        res.json({ 
            success: true, 
            message: 'Bot pairing initiated. Scan QR code with WhatsApp.' 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Bot Stats
app.get('/api/bot-stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const bot = await Bot.findOne({ userId });
        if (!bot) {
            return res.json({ 
                paired: false,
                message: 'Bot not paired' 
            });
        }

        // Get total reports by this bot
        const totalReports = await Report.countDocuments({ botId: bot._id });
        const activeUsers = await Bot.countDocuments({ status: 'connected' });

        res.json({
            paired: true,
            botId: bot._id,
            status: bot.status,
            totalReports,
            activeUsers,
            userCoins: user.coins
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get All Reports
app.get('/api/reports/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const reports = await Report.find({ reporterId: userId })
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({ reports });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
