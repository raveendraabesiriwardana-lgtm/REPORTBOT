// telegram-bot.js - Telegram Bot for WhatsApp Channels
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

class TelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            console.error('❌ TELEGRAM_BOT_TOKEN not set');
            process.exit(1);
        }
        
        this.bot = new Telegraf(this.token);
        this.isRunning = false;
        this.channelHandlers = {};
    }

    async start() {
        try {
            // Bot info
            const botInfo = await this.bot.telegram.getMe();
            console.log(`🤖 Telegram Bot started: @${botInfo.username}`);
            
            // Setup handlers
            this.setupHandlers();
            
            // Start bot
            this.bot.launch();
            this.isRunning = true;
            
            console.log('✅ Telegram Bot is running');
            
        } catch (error) {
            console.error('❌ Failed to start Telegram Bot:', error.message);
            process.exit(1);
        }
    }

    setupHandlers() {
        // Start command
        this.bot.start(async (ctx) => {
            await ctx.reply(`
🤖 <b>WNT REPORT BOT</b>

Welcome to WhatsApp Report Bot!

📱 <b>Commands:</b>
/start - Show this menu
/status - Check bot status
/help - Get help

🔐 <b>Features:</b>
- OTP via WhatsApp Channel
- Report spam numbers
- Coin earning system

📌 <b>Channels:</b>
📧 Email OTP Channel: ${process.env.CHANNEL_EMAIL}
📱 Phone OTP Channel: ${process.env.CHANNEL_PHONE}

        `, { parse_mode: 'HTML' });
        });

        // Help command
        this.bot.command('help', async (ctx) => {
            await ctx.reply(`
❓ <b>Help & Support</b>

📧 <b>Email OTP Channel:</b> ${process.env.CHANNEL_EMAIL}
📱 <b>Phone OTP Channel:</b> ${process.env.CHANNEL_PHONE}

🔐 <b>OTP System:</b>
• OTP expires in 10 minutes
• Max 3 attempts
• Resend after 1 minute

💰 <b>Coins:</b>
• Welcome bonus: 10 coins
• Report cost: 10 coins
• Referral reward: 10 coins

🌐 <b>Website:</b> ${process.env.WEBSITE_URL}
            `, { parse_mode: 'HTML' });
        });

        // Status command
        this.bot.command('status', async (ctx) => {
            await ctx.reply(`
📊 <b>Bot Status</b>

🤖 Status: ${this.isRunning ? '🟢 Online' : '🔴 Offline'}
📅 Uptime: ${process.uptime().toFixed(0)}s
📧 Channel: ${process.env.CHANNEL_EMAIL}
📱 Channel: ${process.env.CHANNEL_PHONE}

✅ All systems operational
            `, { parse_mode: 'HTML' });
        });

        // Handle unknown commands
        this.bot.on('text', async (ctx) => {
            await ctx.reply('❓ Unknown command. Use /help to see available commands.');
        });

        // Error handling
        this.bot.catch((err, ctx) => {
            console.error('❌ Bot error:', err);
            ctx.reply('⚠️ An error occurred. Please try again later.');
        });
    }

    // Send message to channel
    async sendMessageToChannel(channelId, message) {
        try {
            await this.bot.telegram.sendMessage(channelId, message, {
                parse_mode: 'HTML'
            });
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to send message to channel:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Stop bot
    stop() {
        if (this.bot) {
            this.bot.stop();
            this.isRunning = false;
            console.log('🛑 Telegram Bot stopped');
        }
    }
}

module.exports = TelegramBot;
