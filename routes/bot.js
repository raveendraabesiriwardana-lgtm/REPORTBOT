// routes/bot.js
const express = require('express');
const router = express.Router();
const { User, Bot, Report } = require('../models');
const WhatsAppBot = require('../bot');

// Pair bot
router.post('/pair', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if bot already exists
        let existingBot = await Bot.findOne({ userId });
        if (existingBot && existingBot.status === 'connected') {
            return res.status(400).json({ error: 'Bot already connected' });
        }

        // If bot exists but disconnected, delete old session
        if (existingBot) {
            await Bot.deleteOne({ userId });
        }

        // Create new bot session
        const whatsappBot = new WhatsAppBot(userId);
        await whatsappBot.initialize();

        // Save bot to database
        const botRecord = new Bot({
            userId: userId,
            sessionId: `bot-${userId}`,
            status: 'connecting'
        });
        await botRecord.save();

        user.pairedBot = true;
        await user.save();

        res.json({
            success: true,
            message: 'Bot pairing initiated. Please scan QR code.',
            botId: botRecord._id
        });

    } catch (error) {
        console.error('Bot pairing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get bot status
router.get('/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const bot = await Bot.findOne({ userId });
        if (!bot) {
            return res.json({ 
                paired: false,
                message: 'Bot not paired' 
            });
        }

        const totalReports = await Report.countDocuments({ botId: bot._id });
        const activeBots = await Bot.countDocuments({ status: 'connected' });

        res.json({
            paired: true,
            botId: bot._id,
            status: bot.status,
            totalReports,
            activeUsers: activeBots,
            qrCode: bot.qrCode || null,
            lastActive: bot.lastActive
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Disconnect bot
router.post('/disconnect', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const bot = await Bot.findOne({ userId });
        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        bot.status = 'disconnected';
        await bot.save();

        await User.findByIdAndUpdate(userId, { pairedBot: false });

        res.json({
            success: true,
            message: 'Bot disconnected successfully'
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
