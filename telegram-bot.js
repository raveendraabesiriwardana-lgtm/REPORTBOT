// telegram-bot.js - SUPER SIMPLE WORKING VERSION
const { Telegraf } = require('telegraf');

console.log('🤖 Starting Telegram Bot...');

const token = process.env.TELEGRAM_BOT_TOKEN || '8883371319:AAFmTQw_sCGV0PGO-W_Q_Uh_rSAnS24fZkY';
const bot = new Telegraf(token);

// Start command
bot.start((ctx) => {
    console.log('✅ /start received from:', ctx.from.id);
    ctx.reply(`
🤖 <b>WNT REPORT BOT</b>

✅ Bot is WORKING!

📱 Commands:
/start - Menu
/help - Help
/test - Test

🌐 Website: ${process.env.WEBSITE_URL || 'https://wnt-cf16e0065106.herokuapp.com'}
    `, { parse_mode: 'HTML' });
});

// Help
bot.help((ctx) => {
    ctx.reply('❓ Send /start to see menu');
});

// Test
bot.command('test', (ctx) => {
    ctx.reply('✅ Bot is working!');
});

// Error handling
bot.catch((err) => {
    console.error('❌ Bot error:', err.message);
});

// START BOT
bot.launch({
    dropPendingUpdates: true
}).then(() => {
    console.log('✅ Telegram Bot is RUNNING!');
    console.log('✅ Send /start to @Wnt_CHANNEL_OPT_BOT');
}).catch((err) => {
    console.error('❌ Failed:', err.message);
});

// Export for server.js
module.exports = bot;
