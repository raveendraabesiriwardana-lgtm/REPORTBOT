// routes/auth.js
const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { sendVerificationEmail, generateToken } = require('../utils/helpers');

// Sign up
router.post('/signup', async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        
        const existingUser = await User.findOne({ 
            $or: [{ email }, { phone }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                error: 'User already exists with this email or phone' 
            });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const user = new User({
            name,
            phone,
            email,
            verificationCode,
            referralLink: `https://${req.get('host')}/register?ref=${Date.now()}`
        });
        
        await user.save();

        await sendVerificationEmail(email, verificationCode);

        res.json({ 
            success: true, 
            message: 'Verification code sent to your email',
            userId: user._id 
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify code
router.post('/verify', async (req, res) => {
    try {
        const { userId, code } = req.body;
        
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

        const token = generateToken(user._id);

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

// Resend code
router.post('/resend-code', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = verificationCode;
        await user.save();

        await sendVerificationEmail(user.email, verificationCode);

        res.json({ 
            success: true, 
            message: 'New verification code sent to your email' 
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.isVerified) {
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            user.verificationCode = verificationCode;
            await user.save();

            await sendVerificationEmail(email, verificationCode);

            return res.json({
                requiresVerification: true,
                userId: user._id,
                message: 'Verification code sent'
            });
        }

        const token = generateToken(user._id);

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

module.exports = router;
