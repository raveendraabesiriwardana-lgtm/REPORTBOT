// telegram-bot.js - SIMPLE WORKING VERSION
const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN || '8883371319:AAFmTQw_sCGV0PGO-W_Q_Uh_rSAnS24fZkY';
const bot = new Telegraf(token);

// Start command
bot.start((ctx) => {
    console.log('📩 /start from:', ctx.from.id);
    ctx.reply(`
🤖 <b>WNT REPORT BOT</b>

Welcome! Bot is working!

📱 Commands:
/start - Menu
/help - Help
/status - Status
/test - Test

🌐 Website: ${process.env.WEBSITE_URL || 'https://wntreportbot-151893f262be.herokuapp.com'}
    `, { parse_mode: 'HTML' });
});

// Help command
bot.help((ctx) => {
    ctx.reply(`
❓ <b>Help</b>

📧 Email Channel: ${process.env.CHANNEL_EMAIL || 'Not set'}
📱 Phone Channel: ${process.env.CHANNEL_PHONE || 'Not set'}

🔐 OTP expires in 10 minutes
💰 Report costs 10 coins
    `, { parse_mode: 'HTML' });
});

// Status command
bot.command('status', (ctx) => {
    ctx.reply(`
📊 <b>Status</b>
✅ Bot is Online
⏱️ Uptime: ${Math.floor(process.uptime())}s
    `, { parse_mode: 'HTML' });
});

// Test command
bot.command('test', (ctx) => {
    ctx.reply('✅ Bot is working!');
});

// Handle any text
bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    ctx.reply('Send /start to see menu');
});

// Error handling
bot.catch((err, ctx) => {
    console.error('❌ Error:', err.message);
    ctx.reply('⚠️ Error occurred');
});

// Start bot
console.log('🤖 Starting Telegram Bot...');
bot.launch({
    dropPendingUpdates: true
}).then(() => {
    console.log('✅ Telegram Bot is running!');
}).catch(err => {
    console.error('❌ Failed to start:', err.message);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
