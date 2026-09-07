// utils/whatsapp-channel.js - WhatsApp Channel OTP Sender
const axios = require('axios');

class WhatsAppChannelSender {
    constructor() {
        this.emailChannel = process.env.CHANNEL_EMAIL;
        this.phoneChannel = process.env.CHANNEL_PHONE;
        this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        this.telegramBotUrl = `https://api.telegram.org/bot${this.telegramBotToken}`;
    }

    // Send OTP via Telegram Bot to WhatsApp Channel
    async sendOTPToChannel(channelId, message, type) {
        try {
            const payload = {
                chat_id: channelId,
                text: message,
                parse_mode: 'HTML'
            };

            const response = await axios.post(
                `${this.telegramBotUrl}/sendMessage`,
                payload
            );

            console.log(`✅ ${type} OTP sent to channel ${channelId}`);
            return { success: true, messageId: response.data.result.message_id };
            
        } catch (error) {
            console.error(`❌ Failed to send ${type} OTP:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // Format OTP Message
    formatOTPMessage(type, code, identifier) {
        const timestamp = new Date().toLocaleString('en-US', { 
            timeZone: 'Asia/Colombo',
            hour12: false
        });
        
        let message = '';
        
        if (type === 'EMAIL') {
            const email = identifier;
            const maskedEmail = this.maskEmail(email);
            message = `
🇱🇰 #LK  ${maskedEmail}
✉️ 𝑪𝒐𝒅𝒆: \`${code}\`
> WNTREPORTBOTOTP✅
📅 ${timestamp}
🔐 Your verification code for Email
⏳ Expires in 10 minutes
            `.trim();
        } else if (type === 'PHONE') {
            const phone = identifier;
            const maskedPhone = this.maskPhone(phone);
            message = `
🇹🇬 #TG  ${maskedPhone}
✉️ 𝑪𝒐𝒅𝒆: \`${code}\`
> WNTREPORTBOTOTP✅
📅 ${timestamp}
🔐 Your verification code for Phone
⏳ Expires in 10 minutes
            `.trim();
        }
        
        return message;
    }

    // Mask Email
    maskEmail(email) {
        if (!email) return email;
        const [name, domain] = email.split('@');
        if (name.length <= 2) return email;
        const maskedName = name.slice(0, 2) + '...' + name.slice(-2);
        return `${maskedName}@${domain}`;
    }

    // Mask Phone Number
    maskPhone(phone) {
        if (!phone) return phone;
        const cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.length <= 4) return phone;
        const start = cleaned.slice(0, 3);
        const end = cleaned.slice(-4);
        return `${start}...${end}`;
    }

    // Send Email OTP
    async sendEmailOTP(email, code) {
        const message = this.formatOTPMessage('EMAIL', code, email);
        return await this.sendOTPToChannel(this.emailChannel, message, 'EMAIL');
    }

    // Send Phone OTP
    async sendPhoneOTP(phone, code) {
        const message = this.formatOTPMessage('PHONE', code, phone);
        return await this.sendOTPToChannel(this.phoneChannel, message, 'PHONE');
    }

    // Test Channel Connection
    async testConnection() {
        try {
            const testMessage = `
🧪 Test Message
> Channel is working! ✅
📅 ${new Date().toISOString()}
            `.trim();
            
            const result = await this.sendOTPToChannel(
                this.emailChannel,
                testMessage,
                'TEST'
            );
            
            return result.success;
        } catch (error) {
            console.error('❌ Channel test failed:', error.message);
            return false;
        }
    }
}

module.exports = new WhatsAppChannelSender();
