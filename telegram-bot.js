// telegram-bot.js - Class Version (server.js එකට ගැලපෙන)
const { Telegraf } = require('telegraf');

class TelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN || '8883371319:AAFmTQw_sCGV0PGO-W_Q_Uh_rSAnS24fZkY';
        this.bot = new Telegraf(this.token);
        this.isRunning = false;
    }

    async start() {
        try {
            console.log('🤖 Starting Telegram Bot...');
            
            // Delete webhook
            try {
                await this.bot.telegram.deleteWebhook();
                console.log('✅ Webhook deleted');
            } catch (e) {
                console.log('⚠️ Webhook delete:', e.message);
            }
            
            // Get bot info
            const botInfo = await this.bot.telegram.getMe();
            console.log(`✅ Bot connected: @${botInfo.username}`);
            
            // Setup handlers
            this.setupHandlers();
            
            // Start bot
            await this.bot.launch({
                dropPendingUpdates: true
            });
            
            this.isRunning = true;
            console.log('✅ Telegram Bot is running!');
            return true;
            
        } catch (error) {
            console.error('❌ Telegram Bot error:', error.message);
            this.isRunning = false;
            return false;
        }
    }

    setupHandlers() {
        // Start command
        this.bot.start((ctx) => {
            console.log('📩 /start from:', ctx.from.id);
            ctx.reply(`
🤖 <b>WNT REPORT BOT</b>

Welcome! Bot is working!

📱 Commands:
/start - Menu
/help - Help
/status - Status
/test - Test

🌐 Website: ${process.env.WEBSITE_URL || 'https://wnt-cf16e0065106.herokuapp.com'}
            `, { parse_mode: 'HTML' });
        });

        // Help command
        this.bot.help((ctx) => {
            ctx.reply(`
❓ <b>Help</b>

📧 Email Channel: ${process.env.CHANNEL_EMAIL || 'Not set'}
📱 Phone Channel: ${process.env.CHANNEL_PHONE || 'Not set'}

🔐 OTP expires in 10 minutes
💰 Report costs 10 coins
            `, { parse_mode: 'HTML' });
        });

        // Status command
        this.bot.command('status', (ctx) => {
            ctx.reply(`
📊 <b>Status</b>
✅ Bot is Online
⏱️ Uptime: ${Math.floor(process.uptime())}s
            `, { parse_mode: 'HTML' });
        });

        // Test command
        this.bot.command('test', (ctx) => {
            ctx.reply('✅ Bot is working! Send /start to see menu.');
        });

        // Handle text
        this.bot.on('text', (ctx) => {
            if (ctx.message.text.startsWith('/')) return;
            ctx.reply('Send /start to see menu');
        });

        // Error handling
        this.bot.catch((err, ctx) => {
            console.error('❌ Bot error:', err.message);
            ctx.reply('⚠️ Error occurred');
        });
    }

    // Send message to channel
    async sendMessageToChannel(channelId, message) {
        try {
            if (!this.isRunning || !this.bot) {
                return { success: false, error: 'Bot not running' };
            }
            const result = await this.bot.telegram.sendMessage(channelId, message, {
                parse_mode: 'HTML'
            });
            return { success: true, messageId: result.message_id };
        } catch (error) {
            console.error('❌ Send message error:', error.message);
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
