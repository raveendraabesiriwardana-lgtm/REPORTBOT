// bot.js - මුල් ෆෝල්ඩරයේ
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { User, Bot, Report } = require('./models');

class WhatsAppBot {
    constructor(userId) {
        this.userId = userId;
        this.client = null;
        this.isReady = false;
    }

    async initialize() {
        try {
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: `bot-${this.userId}`
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ]
                }
            });

            this.client.on('qr', (qr) => {
                console.log(`📱 QR Code for user ${this.userId}`);
                qrcode.generate(qr, { small: true });
            });

            this.client.on('ready', async () => {
                console.log(`✅ Bot ready for user ${this.userId}`);
                this.isReady = true;
                
                await Bot.findOneAndUpdate(
                    { userId: this.userId },
                    { status: 'connected', lastActive: new Date() }
                );
            });

            this.client.on('message', async (message) => {
                await this.handleMessage(message);
            });

            this.client.on('disconnected', async () => {
                this.isReady = false;
                await Bot.findOneAndUpdate(
                    { userId: this.userId },
                    { status: 'disconnected' }
                );
            });

            await this.client.initialize();
            
        } catch (error) {
            console.error('Bot initialization error:', error);
            throw error;
        }
    }

    async handleMessage(message) {
        try {
            if (!message.body.startsWith('.')) return;

            const parts = message.body.split(' ');
            const command = parts[0].toLowerCase();

            if (command === '.report') {
                await this.handleReport(message, parts.slice(1));
            } else if (command === '.balance') {
                await this.handleBalance(message);
            } else if (command === '.help') {
                await this.handleHelp(message);
            }

        } catch (error) {
            console.error('Message handling error:', error);
            await message.reply('❌ An error occurred.');
        }
    }

    async handleReport(message, args) {
        if (args.length < 1) {
            await message.reply('❌ Usage: .report <phone_number>');
            return;
        }

        const targetNumber = args[0];
        const senderNumber = message.from.replace('@c.us', '');
        
        const user = await User.findOne({ phone: senderNumber });
        if (!user) {
            await message.reply('❌ You are not registered.');
            return;
        }

        if (user.coins < 10) {
            await message.reply(`❌ Insufficient coins! You have ${user.coins} coins.`);
            return;
        }

        user.coins -= 10;
        await user.save();

        const report = new Report({
            reportedNumber: targetNumber,
            reporterId: user._id
        });
        await report.save();

        const activeBots = await Bot.countDocuments({ status: 'connected' });

        await message.reply(
            `✅ Report sent for ${targetNumber}!\n` +
            `📊 Active Bots: ${activeBots}\n` +
            `🪙 Remaining Coins: ${user.coins}`
        );
    }

    async handleBalance(message) {
        const senderNumber = message.from.replace('@c.us', '');
        const user = await User.findOne({ phone: senderNumber });
        
        if (!user) {
            await message.reply('❌ You are not registered.');
            return;
        }

        await message.reply(
            `💰 Your Balance\n\n` +
            `🪙 Coins: ${user.coins}\n` +
            `📊 Total Reports: ${await Report.countDocuments({ reporterId: user._id })}`
        );
    }

    async handleHelp(message) {
        await message.reply(
            `🤖 WhatsApp Report Bot\n\n` +
            `.report <number> - Report a number (10 coins)\n` +
            `.balance - Check your balance\n` +
            `.help - Show this help`
        );
    }

    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
        }
    }
}

module.exports = WhatsAppBot;
