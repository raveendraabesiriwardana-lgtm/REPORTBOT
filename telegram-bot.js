// telegram-bot.js - Full Working Version
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
        this.channelHandlers = {};
    }

    async start() {
        try {
            console.log('🤖 Starting Telegram Bot...');
            
            // Get bot info
            const botInfo = await this.bot.telegram.getMe();
            console.log(`✅ Bot connected: @${botInfo.username}`);
            console.log(`🆔 Bot ID: ${botInfo.id}`);
            
            // Setup handlers
            this.setupHandlers();
            
            // Start bot with polling
            await this.bot.launch({
                dropPendingUpdates: true
            });
            
            this.isRunning = true;
            console.log('✅ Telegram Bot is running (polling mode)');
            
            // Send test message to bot itself
            await this.testBot();
            
        } catch (error) {
            console.error('❌ Telegram Bot error:', error.message);
            this.isRunning = false;
        }
    }

    setupHandlers() {
        // ========== START COMMAND ==========
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
/about - About bot

🔐 <b>Features:</b>
• OTP via WhatsApp Channel
• Report spam numbers
• Coin earning system
• Referral program

📌 <b>Channels:</b>
📧 Email OTP: ${process.env.CHANNEL_EMAIL || 'Not set'}
📱 Phone OTP: ${process.env.CHANNEL_PHONE || 'Not set'}

🌐 <b>Website:</b> ${process.env.WEBSITE_URL || 'https://your-app.herokuapp.com'}

💡 <i>Send /help for more info</i>
            `;
            
            await ctx.reply(message, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        });

        // ========== HELP COMMAND ==========
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
• Referral reward: 10 coins

📱 <b>WhatsApp Commands:</b>
<code>.report &lt;number&gt;</code> - Report a number
<code>.balance</code> - Check your balance
<code>.help</code> - Show commands

🌐 <b>Website:</b> 
${process.env.WEBSITE_URL || 'Not set'}

🤖 <b>Bot Status:</b> ${this.isRunning ? '🟢 Online' : '🔴 Offline'}
            `;
            
            await ctx.reply(message, { parse_mode: 'HTML' });
        });

        // ========== STATUS COMMAND ==========
        this.bot.command('status', async (ctx) => {
            const uptime = Math.floor(process.uptime());
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            const message = `
📊 <b>Bot Status</b>

🤖 Status: ${this.isRunning ? '🟢 Online' : '🔴 Offline'}
⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s
📅 Started: ${new Date().toLocaleString()}

📧 Email Channel: ${process.env.CHANNEL_EMAIL ? '✅ Set' : '❌ Not set'}
📱 Phone Channel: ${process.env.CHANNEL_PHONE ? '✅ Set' : '❌ Not set'}

🌐 Website: ${process.env.WEBSITE_URL || 'Not set'}

✅ Bot is fully operational
            `;
            
            await ctx.reply(message, { parse_mode: 'HTML' });
        });

        // ========== TEST COMMAND ==========
        this.bot.command('test', async (ctx) => {
            await ctx.reply('✅ Bot is working! Send /start to see menu.');
        });

        // ========== ABOUT COMMAND ==========
        this.bot.command('about', async (ctx) => {
            const message = `
ℹ️ <b>About WNT Report Bot</b>

📌 <b>Version:</b> 2.0.0
📅 <b>Built:</b> September 2026

<b>Features:</b>
• WhatsApp Channel OTP System
• Multi-channel support
• Auto-expiring OTP
• Coin reward system
• Referral tracking

<b>Bot Info:</b>
• Name: @Wnt_CHANNEL_OPT_BOT
• ID: ${ctx.botInfo?.id || 'Unknown'}
• Status: ${this.isRunning ? '🟢 Online' : '🔴 Offline'}

<i>Made with ❤️ for WhatsApp Report Bot</i>
            `;
            
            await ctx.reply(message, { parse_mode: 'HTML' });
        });

        // ========== HANDLE TEXT MESSAGES ==========
        this.bot.on('text', async (ctx) => {
            const text = ctx.message.text;
            
            // Skip commands
            if (text.startsWith('/')) return;
            
            // Send help for any text
            await ctx.reply(`
🤖 <b>I received:</b> "${text}"

Use /help to see available commands.
Send /start to see the main menu.
            `, { parse_mode: 'HTML' });
        });

        // ========== HANDLE NEW CHAT MEMBERS ==========
        this.bot.on('new_chat_members', async (ctx) => {
            const newMembers = ctx.message.new_chat_members;
            for (const member of newMembers) {
                if (member.is_bot) {
                    await ctx.reply(`✅ Bot @${member.username} added to the chat!`);
                }
            }
        });

        // ========== ERROR HANDLING ==========
        this.bot.catch((err, ctx) => {
            console.error('❌ Bot error:', err.message);
            ctx.reply('⚠️ An error occurred. Please try again later.')
                .catch(e => console.error('Reply error:', e.message));
        });
    }

    // Test bot functionality
    async testBot() {
        try {
            const botInfo = await this.bot.telegram.getMe();
            console.log(`✅ Bot @${botInfo.username} is ready for testing`);
            
            // Try to send a message to the bot itself (won't work, but tests the API)
            console.log('✅ Bot API test passed');
            return true;
            
        } catch (error) {
            console.error('❌ Bot test failed:', error.message);
            return false;
        }
    }

    // Send message to channel
    async sendMessageToChannel(channelId, message) {
        try {
            if (!this.isRunning || !this.bot) {
                console.log('⚠️ Bot not running, cannot send message');
                return { success: false, error: 'Bot not running' };
            }

            if (!channelId) {
                console.log('⚠️ Channel ID not set');
                return { success: false, error: 'Channel ID not set' };
            }

            // Ensure channel ID has -100 prefix if it's a channel
            let chatId = channelId;
            if (!chatId.toString().startsWith('-100') && !chatId.toString().startsWith('-')) {
                chatId = `-100${chatId}`;
            }

            const result = await this.bot.telegram.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
            
            console.log(`✅ Message sent to channel: ${chatId}`);
            return { success: true, messageId: result.message_id };
            
        } catch (error) {
            console.error('❌ Failed to send message to channel:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
            return { success: false, error: error.message };
        }
    }

    // Send OTP to both channels
    async sendOTP(otpData) {
        const { email, phone, code, type } = otpData;
        const results = [];
        
        if (email && process.env.CHANNEL_EMAIL) {
            const message = this.formatOTPMessage('EMAIL', code, email);
            const result = await this.sendMessageToChannel(process.env.CHANNEL_EMAIL, message);
            results.push({ channel: 'EMAIL', ...result });
        }
        
        if (phone && process.env.CHANNEL_PHONE) {
            const message = this.formatOTPMessage('PHONE', code, phone);
            const result = await this.sendMessageToChannel(process.env.CHANNEL_PHONE, message);
            results.push({ channel: 'PHONE', ...result });
        }
        
        return results;
    }

    // Format OTP Message
    formatOTPMessage(type, code, identifier) {
        const timestamp = new Date().toLocaleString('en-US', { 
            timeZone: 'Asia/Colombo',
            hour12: false
        });
        
        let message = '';
        
        if (type === 'EMAIL') {
            const maskedEmail = this.maskEmail(identifier);
            message = `
🇱🇰 #LK ${maskedEmail}
✉️ 𝑪𝒐𝒅𝒆: <code>${code}</code>
> WNTREPORTBOTOTP✅
📅 ${timestamp}
🔐 Your verification code for Email
⏳ Expires in 10 minutes
            `.trim();
        } else if (type === 'PHONE') {
            const maskedPhone = this.maskPhone(identifier);
            message = `
🇹🇬 #TG ${maskedPhone}
✉️ 𝑪𝒐𝒅𝒆: <code>${code}</code>
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

    // Stop bot
    stop() {
        if (this.bot) {
            this.bot.stop();
            this.isRunning = false;
            console.log('🛑 Telegram Bot stopped');
        }
    }
}

module.exports = TelegramBot;// telegram-bot.js - Full Working Version
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
        this.channelHandlers = {};
    }

    async start() {
        try {
            console.log('🤖 Starting Telegram Bot...');
            
            // Get bot info
            const botInfo = await this.bot.telegram.getMe();
            console.log(`✅ Bot connected: @${botInfo.username}`);
            console.log(`🆔 Bot ID: ${botInfo.id}`);
            
            // Setup handlers
            this.setupHandlers();
            
            // Start bot with polling
            await this.bot.launch({
                dropPendingUpdates: true
            });
            
            this.isRunning = true;
            console.log('✅ Telegram Bot is running (polling mode)');
            
            // Send test message to bot itself
            await this.testBot();
            
        } catch (error) {
            console.error('❌ Telegram Bot error:', error.message);
            this.isRunning = false;
        }
    }

    setupHandlers() {
        // ========== START COMMAND ==========
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
/about - About bot

🔐 <b>Features:</b>
• OTP via WhatsApp Channel
• Report spam numbers
• Coin earning system
• Referral program

📌 <b>Channels:</b>
📧 Email OTP: ${process.env.CHANNEL_EMAIL || 'Not set'}
📱 Phone OTP: ${process.env.CHANNEL_PHONE || 'Not set'}

🌐 <b>Website:</b> ${process.env.WEBSITE_URL || 'https://your-app.herokuapp.com'}

💡 <i>Send /help for more info</i>
            `;
            
            await ctx.reply(message, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        });

        // ========== HELP COMMAND ==========
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
• Referral reward: 10 coins

📱 <b>WhatsApp Commands:</b>
<code>.report &lt;number&gt;</code> - Report a number
<code>.balance</code> - Check your balance
<code>.help</code> - Show commands

🌐 <b>Website:</b> 
${process.env.WEBSITE_URL || 'Not set'}

🤖 <b>Bot Status:</b> ${this.isRunning ? '🟢 Online' : '🔴 Offline'}
            `;
            
            await ctx.reply(message, { parse_mode: 'HTML' });
        });

        // ========== STATUS COMMAND ==========
        this.bot.command('status', async (ctx) => {
            const uptime = Math.floor(process.uptime());
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            const message = `
📊 <b>Bot Status</b>

🤖 Status: ${this.isRunning ? '🟢 Online' : '🔴 Offline'}
⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s
📅 Started: ${new Date().toLocaleString()}

📧 Email Channel: ${process.env.CHANNEL_EMAIL ? '✅ Set' : '❌ Not set'}
📱 Phone Channel: ${process.env.CHANNEL_PHONE ? '✅ Set' : '❌ Not set'}

🌐 Website: ${process.env.WEBSITE_URL || 'Not set'}

✅ Bot is fully operational
            `;
            
            await ctx.reply(message, { parse_mode: 'HTML' });
        });

        // ========== TEST COMMAND ==========
        this.bot.command('test', async (ctx) => {
            await ctx.reply('✅ Bot is working! Send /start to see menu.');
        });

        // ========== ABOUT COMMAND ==========
        this.bot.command('about', async (ctx) => {
            const message = `
ℹ️ <b>About WNT Report Bot</b>

📌 <b>Version:</b> 2.0.0
📅 <b>Built:</b> September 2026

<b>Features:</b>
• WhatsApp Channel OTP System
• Multi-channel support
• Auto-expiring OTP
• Coin reward system
• Referral tracking

<b>Bot Info:</b>
• Name: @Wnt_CHANNEL_OPT_BOT
• ID: ${ctx.botInfo?.id || 'Unknown'}
• Status: ${this.isRunning ? '🟢 Online' : '🔴 Offline'}

<i>Made with ❤️ for WhatsApp Report Bot</i>
            `;
            
            await ctx.reply(message, { parse_mode: 'HTML' });
        });

        // ========== HANDLE TEXT MESSAGES ==========
        this.bot.on('text', async (ctx) => {
            const text = ctx.message.text;
            
            // Skip commands
            if (text.startsWith('/')) return;
            
            // Send help for any text
            await ctx.reply(`
🤖 <b>I received:</b> "${text}"

Use /help to see available commands.
Send /start to see the main menu.
            `, { parse_mode: 'HTML' });
        });

        // ========== HANDLE NEW CHAT MEMBERS ==========
        this.bot.on('new_chat_members', async (ctx) => {
            const newMembers = ctx.message.new_chat_members;
            for (const member of newMembers) {
                if (member.is_bot) {
                    await ctx.reply(`✅ Bot @${member.username} added to the chat!`);
                }
            }
        });

        // ========== ERROR HANDLING ==========
        this.bot.catch((err, ctx) => {
            console.error('❌ Bot error:', err.message);
            ctx.reply('⚠️ An error occurred. Please try again later.')
                .catch(e => console.error('Reply error:', e.message));
        });
    }

    // Test bot functionality
    async testBot() {
        try {
            const botInfo = await this.bot.telegram.getMe();
            console.log(`✅ Bot @${botInfo.username} is ready for testing`);
            
            // Try to send a message to the bot itself (won't work, but tests the API)
            console.log('✅ Bot API test passed');
            return true;
            
        } catch (error) {
            console.error('❌ Bot test failed:', error.message);
            return false;
        }
    }

    // Send message to channel
    async sendMessageToChannel(channelId, message) {
        try {
            if (!this.isRunning || !this.bot) {
                console.log('⚠️ Bot not running, cannot send message');
                return { success: false, error: 'Bot not running' };
            }

            if (!channelId) {
                console.log('⚠️ Channel ID not set');
                return { success: false, error: 'Channel ID not set' };
            }

            // Ensure channel ID has -100 prefix if it's a channel
            let chatId = channelId;
            if (!chatId.toString().startsWith('-100') && !chatId.toString().startsWith('-')) {
                chatId = `-100${chatId}`;
            }

            const result = await this.bot.telegram.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
            
            console.log(`✅ Message sent to channel: ${chatId}`);
            return { success: true, messageId: result.message_id };
            
        } catch (error) {
            console.error('❌ Failed to send message to channel:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
            return { success: false, error: error.message };
        }
    }

    // Send OTP to both channels
    async sendOTP(otpData) {
        const { email, phone, code, type } = otpData;
        const results = [];
        
        if (email && process.env.CHANNEL_EMAIL) {
            const message = this.formatOTPMessage('EMAIL', code, email);
            const result = await this.sendMessageToChannel(process.env.CHANNEL_EMAIL, message);
            results.push({ channel: 'EMAIL', ...result });
        }
        
        if (phone && process.env.CHANNEL_PHONE) {
            const message = this.formatOTPMessage('PHONE', code, phone);
            const result = await this.sendMessageToChannel(process.env.CHANNEL_PHONE, message);
            results.push({ channel: 'PHONE', ...result });
        }
        
        return results;
    }

    // Format OTP Message
    formatOTPMessage(type, code, identifier) {
        const timestamp = new Date().toLocaleString('en-US', { 
            timeZone: 'Asia/Colombo',
            hour12: false
        });
        
        let message = '';
        
        if (type === 'EMAIL') {
            const maskedEmail = this.maskEmail(identifier);
            message = `
🇱🇰 #LK ${maskedEmail}
✉️ 𝑪𝒐𝒅𝒆: <code>${code}</code>
> WNTREPORTBOTOTP✅
📅 ${timestamp}
🔐 Your verification code for Email
⏳ Expires in 10 minutes
            `.trim();
        } else if (type === 'PHONE') {
            const maskedPhone = this.maskPhone(identifier);
            message = `
🇹🇬 #TG ${maskedPhone}
✉️ 𝑪𝒐𝒅𝒆: <code>${code}</code>
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
