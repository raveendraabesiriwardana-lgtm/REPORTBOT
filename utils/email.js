// utils/email.js - Gmail API එක use කරන email system
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Email transporter create කරන්න
let transporter = null;

// Initialize email transporter
function createTransporter() {
    try {
        // Gmail transporter
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            },
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateLimit: true
        });

        // Verify connection
        transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Email transporter error:', error.message);
                console.log('⚠️ Using fallback mode (console only)');
                transporter = null;
            } else {
                console.log('✅ Email transporter ready');
            }
        });

        return transporter;
    } catch (error) {
        console.error('❌ Failed to create email transporter:', error.message);
        return null;
    }
}

// Send email with retry logic
async function sendEmailWithRetry(mailOptions, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (!transporter) {
                createTransporter();
                if (!transporter) {
                    throw new Error('Email transporter not available');
                }
            }

            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ Email sent (attempt ${attempt}):`, info.messageId);
            return { success: true, messageId: info.messageId };
            
        } catch (error) {
            lastError = error;
            console.log(`❌ Attempt ${attempt} failed:`, error.message);
            
            // If error is authentication error, recreate transporter
            if (error.message.includes('535')) {
                console.log('🔄 Authentication error, recreating transporter...');
                transporter = null;
                createTransporter();
            }
            
            // Wait before retry
            if (attempt < maxRetries) {
                const waitTime = attempt * 1000;
                console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    console.error('❌ All email attempts failed');
    return { success: false, error: lastError?.message || 'Unknown error' };
}

// Send verification code
async function sendVerificationCode(email, code) {
    try {
        // Create HTML email
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code { font-size: 36px; letter-spacing: 10px; color: #4CAF50; text-align: center; padding: 20px; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 WhatsApp Report Bot</h1>
                    </div>
                    <div class="content">
                        <p>Hello!</p>
                        <p>Your verification code is:</p>
                        <div class="code">${code}</div>
                        <p>This code will expire in <strong>10 minutes</strong>.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message. Please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"WhatsApp Report Bot" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔐 Your Verification Code',
            html: html,
            text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`
        };

        // Try to send with retry
        const result = await sendEmailWithRetry(mailOptions);
        
        if (result.success) {
            console.log('✅ Verification code sent to:', email);
        } else {
            console.error('❌ Failed to send verification code:', result.error);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return { success: false, error: error.message };
    }
}

// Send welcome email
async function sendWelcomeEmail(email, name) {
    try {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to WhatsApp Report Bot!</h1>
                    </div>
                    <div class="content">
                        <p>Hello <strong>${name}</strong>!</p>
                        <p>Your account has been successfully verified.</p>
                        <p>You can now:</p>
                        <ul>
                            <li>🤖 Pair your WhatsApp bot</li>
                            <li>📊 Report spam numbers</li>
                            <li>🪙 Earn coins</li>
                        </ul>
                        <p>Get started now: <a href="${process.env.WEBSITE_URL}">${process.env.WEBSITE_URL}</a></p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"WhatsApp Report Bot" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🎉 Welcome to WhatsApp Report Bot!',
            html: html
        };

        await sendEmailWithRetry(mailOptions);
        return { success: true };
        
    } catch (error) {
        console.error('❌ Welcome email error:', error.message);
        return { success: false, error: error.message };
    }
}

// Send password reset email
async function sendPasswordResetEmail(email, resetCode) {
    try {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #ff6b6b; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔑 Password Reset</h1>
                    </div>
                    <div class="content">
                        <p>You requested a password reset.</p>
                        <p>Your reset code is:</p>
                        <div style="font-size: 36px; letter-spacing: 10px; color: #ff6b6b; text-align: center; padding: 20px;">${resetCode}</div>
                        <p>This code expires in <strong>10 minutes</strong>.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"WhatsApp Report Bot" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔑 Password Reset Code',
            html: html
        };

        await sendEmailWithRetry(mailOptions);
        return { success: true };
        
    } catch (error) {
        console.error('❌ Password reset email error:', error.message);
        return { success: false, error: error.message };
    }
}

// Test email configuration
async function testEmailConfig() {
    console.log('📧 Testing email configuration...');
    
    const testEmail = process.env.EMAIL_USER;
    if (!testEmail) {
        console.log('❌ EMAIL_USER not set');
        return { success: false, error: 'EMAIL_USER not set' };
    }
    
    try {
        if (!transporter) {
            createTransporter();
        }
        
        if (!transporter) {
            return { success: false, error: 'Transporter not initialized' };
        }
        
        // Send test email
        const result = await sendVerificationCode(testEmail, '123456');
        
        if (result.success) {
            console.log('✅ Email configuration test passed');
        } else {
            console.log('❌ Email configuration test failed:', result.error);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Email test error:', error.message);
        return { success: false, error: error.message };
    }
}

// Initialize email system
function initEmailSystem() {
    createTransporter();
    
    // Test email on startup (only in development)
    if (process.env.NODE_ENV !== 'production') {
        setTimeout(async () => {
            await testEmailConfig();
        }, 5000);
    }
    
    console.log('📧 Email system initialized');
}

module.exports = {
    sendVerificationCode,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    testEmailConfig,
    initEmailSystem
};
