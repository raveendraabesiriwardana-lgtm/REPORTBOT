// models.js
const mongoose = require('mongoose');

// User Schema
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    verificationCode: { type: String },
    isVerified: { type: Boolean, default: false },
    coins: { type: Number, default: 0 },
    referralLink: { type: String },
    pairedBot: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Bot Schema
const BotSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sessionId: { type: String, unique: true },
    status: { type: String, default: 'disconnected' },
    qrCode: { type: String },
    totalReports: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
});

// Report Schema
const ReportSchema = new mongoose.Schema({
    reportedNumber: { type: String, required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    botId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot' },
    status: { type: String, default: 'pending' },
    reportCount: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now }
});

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['earn', 'spend'] },
    amount: { type: Number, required: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Bot = mongoose.model('Bot', BotSchema);
const Report = mongoose.model('Report', ReportSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = { User, Bot, Report, Transaction };
