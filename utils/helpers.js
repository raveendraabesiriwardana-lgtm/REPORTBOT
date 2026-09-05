// utils/helpers.js
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Send verification email
async function sendVerificationEmail(email, code) {
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
}

// Generate JWT token
function generateToken(userId) {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Generate referral link
function generateReferralLink(baseUrl, userId) {
    return `${baseUrl}/register?ref=${userId}`;
}

module.exports = {
    sendVerificationEmail,
    generateToken,
    verifyToken,
    generateReferralLink
};
