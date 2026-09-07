// utils/otp.js - OTP Management System
const crypto = require('crypto');

class OTPManager {
    constructor() {
        this.otpStore = new Map(); // userId -> { code, expiry, attempts, lastSent }
    }

    // Generate OTP code
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Create OTP for user
    createOTP(userId) {
        const code = this.generateOTP();
        const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
        const now = Date.now();
        
        const otpData = {
            code: code,
            expiry: now + (expiryMinutes * 60 * 1000),
            attempts: 0,
            maxAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS) || 3,
            lastSent: now,
            verified: false
        };
        
        this.otpStore.set(userId, otpData);
        return code;
    }

    // Verify OTP
    verifyOTP(userId, code) {
        const otpData = this.otpStore.get(userId);
        
        if (!otpData) {
            return { success: false, message: 'OTP not found. Please request a new one.' };
        }
        
        if (otpData.verified) {
            return { success: false, message: 'OTP already used. Please request a new one.' };
        }
        
        if (Date.now() > otpData.expiry) {
            this.otpStore.delete(userId);
            return { success: false, message: 'OTP expired. Please request a new one.' };
        }
        
        if (otpData.attempts >= otpData.maxAttempts) {
            this.otpStore.delete(userId);
            return { success: false, message: 'Too many failed attempts. Please request a new one.' };
        }
        
        if (otpData.code !== code) {
            otpData.attempts += 1;
            this.otpStore.set(userId, otpData);
            return { 
                success: false, 
                message: `Invalid OTP. ${otpData.maxAttempts - otpData.attempts} attempts remaining.` 
            };
        }
        
        otpData.verified = true;
        this.otpStore.set(userId, otpData);
        return { success: true, message: 'OTP verified successfully!' };
    }

    // Check if can resend OTP
    canResend(userId) {
        const otpData = this.otpStore.get(userId);
        if (!otpData) return true;
        
        const resendWaitMinutes = parseInt(process.env.OTP_RESEND_WAIT_MINUTES) || 1;
        const waitTime = resendWaitMinutes * 60 * 1000;
        const timeSinceLastSend = Date.now() - otpData.lastSent;
        
        return timeSinceLastSend >= waitTime;
    }

    // Get remaining time for resend
    getResendWaitTime(userId) {
        const otpData = this.otpStore.get(userId);
        if (!otpData) return 0;
        
        const resendWaitMinutes = parseInt(process.env.OTP_RESEND_WAIT_MINUTES) || 1;
        const waitTime = resendWaitMinutes * 60 * 1000;
        const timeSinceLastSend = Date.now() - otpData.lastSent;
        
        return Math.max(0, waitTime - timeSinceLastSend);
    }

    // Clear OTP
    clearOTP(userId) {
        this.otpStore.delete(userId);
    }

    // Get OTP status
    getOTPStatus(userId) {
        const otpData = this.otpStore.get(userId);
        if (!otpData) return { exists: false };
        
        return {
            exists: true,
            expiry: otpData.expiry,
            attempts: otpData.attempts,
            maxAttempts: otpData.maxAttempts,
            verified: otpData.verified,
            canResend: this.canResend(userId),
            remainingTime: this.getResendWaitTime(userId)
        };
    }
}

module.exports = new OTPManager();
