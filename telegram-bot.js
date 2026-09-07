// telegram-bot.js - Updated with webhook deletion
const { Telegraf } = require('telegraf');

class TelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            console.error('❌ TELEGRAM_BOT_TOKEN not set');
            this.isRunning = false;
            return;
        }
        
        this.bot = new Telegraf(this.token);
        this.isRunning = false;
    }

    async start() {
        try {
            console.log('🤖 Starting Telegram Bot...');
            
            // Delete webhook to avoid conflicts
            try {
                await this.bot.telegram.deleteWebhook();
                console.log('✅ Webhook deleted');
            } catch (webhookError) {
                console.log('⚠️ Webhook delete error:', webhookError.message);
            }
            
            // Get bot info
            const botInfo = await this.bot.telegram.getMe();
            console.log(`✅ Bot connected: @${botInfo.username}`);
            console.log(`🆔 Bot ID: ${botInfo.id}`);
            
            // Setup handlers
            this.setupHandlers();
            
            // Start bot with polling
            await this.bot.launch({
                dropPendingUpdates: true,
                webhook: {
                    enabled: false
                }
            });
            
            this.isRunning = true;
            console.log('✅ Telegram Bot is running (polling mode)');
            
            return true;
            
        } catch (error) {
            console.error('❌ Telegram Bot error:', error.message);
            this.isRunning = false;
            return false;
        }
    }

    setupHandlers() {
        // Start command
        this.bot.start(async (ctx) => {
            console.log(`📩 /start from: ${ctx.from.id} (${ctx.from.username || 'no username'})`);
            
            const message = `
🤖 <b>WNT REPORT BOT</b>

Welcome to WhatsApp Report Bot!

📱 <b>Commands:</b>
/start - Show this menu
/status - Check bot status
/help - Get help
/test - Test bot

🔐 <b>Features:</b>
• OTP via WhatsApp Channel
• Report spam numbers
• Coin earning system

📌 <b>Channels:</b>
📧 Email OTP: ${process.env.CHANNEL_EMAIL || 'Not set'}
📱 Phone OTP: ${process.env.CHANNEL_PHONE || 'Not set'}

🌐 <b>Website:</b> ${process.env.WEBSITE_URL || 'https://your-app.herokuapp.com'}
            `;
            
            await ctx.reply(message, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        });

        // Help command
        this.bot.command('help', async (ctx) => {
            const message = `
❓ <b>Help & Support</b>

📧 <b>Email OTP Channel:</b> 
<code>${process.env.CHANNEL_EMAIL || 'Not set'}</code>

📱 <b>Phone OTP Channel:</b> 
<code>${process.env.CHANNEL_PHONE || 'Not set'}</code>

🔐 <b>OTP System:</b>
• OTP expires in 10 minutes
• Max 3 attempts
• Resend after 1 minute

💰 <b>Coins System:</b>
• Welcome bonus: 10 coins
• Report cost: 10 coins

📱 <b>WhatsApp Commands:</b>
<code>.report &lt;number&gt;</code> - Report a number
<code>.balance</code> - Check your balance
<code>.help</code> - Show commands

🌐 <b>Website:</b> 
${process.env.WEBSITE_URL || 'Not set'}
            `;
            
            await ctx.reply(message, { parse_mode: 'HTML' });
        });

        // Status command
        this.bot.command('status', async (ctx) => {
            const uptime = Math.floor(process.uptime());
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            const message = `
📊 <b>Bot Status</b>

🤖 Status: ${this.isRunning ? '🟢 Online' : '🔴 Offline'}
⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s

📧 Email Channel: ${process.env.CHANNEL_EMAIL ? '✅ Set' : '❌ Not set'}
📱 Phone Channel: ${process.env.CHANNEL_PHONE ? '✅ Set' : '❌ Not set'}

🌐 Website: ${process.env.WEBSITE_URL || 'Not set'}
            `;
            
            await ctx.reply(message, { parse_mode: 'HTML' });
        });

        // Test command
        this.bot.command('test', async (ctx) => {
            await ctx.reply('✅ Bot is working! Send /start to see menu.');
        });

        // Handle text
        this.bot.on('text', async (ctx) => {
            const text = ctx.message.text;
            if (text.startsWith('/')) return;
            
            await ctx.reply(`
🤖 <b>I received:</b> "${text}"

Use /help to see available commands.
Send /start to see the main menu.
            `, { parse_mode: 'HTML' });
        });

        // Error handling
        this.bot.catch((err, ctx) => {
            console.error('❌ Bot error:', err.message);
            ctx.reply('⚠️ An error occurred. Please try again later.');
        });
    }

    // Send message to channel
    async sendMessageToChannel(channelId, message) {
        try {
            if (!this.isRunning || !this.bot) {
                console.log('⚠️ Bot not running');
                return { success: false, error: 'Bot not running' };
            }

            if (!channelId) {
                console.log('⚠️ Channel ID not set');
                return { success: false, error: 'Channel ID not set' };
            }

            const result = await this.bot.telegram.sendMessage(channelId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
            
            console.log(`✅ Message sent to channel: ${channelId}`);
            return { success: true, messageId: result.message_id };
            
        } catch (error) {
            console.error('❌ Failed to send message:', error.message);
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
