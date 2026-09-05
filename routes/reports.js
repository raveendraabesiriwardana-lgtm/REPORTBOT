// routes/reports.js
const express = require('express');
const router = express.Router();
const Report = require('../models');
const User = require('../models');

// Get user's reports
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const reports = await Report.find({ reporterId: userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ 
            success: true, 
            reports,
            count: reports.length 
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get report statistics
router.get('/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const totalReports = await Report.countDocuments({ reporterId: userId });
        const pendingReports = await Report.countDocuments({ 
            reporterId: userId, 
            status: 'pending' 
        });
        const completedReports = await Report.countDocuments({ 
            reporterId: userId, 
            status: 'completed' 
        });

        res.json({
            success: true,
            total: totalReports,
            pending: pendingReports,
            completed: completedReports
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
