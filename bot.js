// bot.js - WhatsApp Bot
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const Database = require('./database');

class WhatsAppBot {
    constructor(userId) {
        this.userId = userId;
        this.client = null;
        this.isReady = false;
        
        const sessionDir = path.join(__dirname, 'sessions');
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        this.sessionPath = path.join(sessionDir, `bot-${userId}`);
    }

    async initialize() {
        try {
            console.log(`🤖 Initializing bot for user: ${this.userId}`);

            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: `bot-${this.userId}`,
                    dataPath: this.sessionPath
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
                
                await Database.updateBot(
                    (await Database.findBot(this.userId))?.id,
                    { status: 'connected' }
                );
            });

            this.client.on('message', async (message) => {
                await this.handleMessage(message);
            });

            this.client.on('disconnected', async () => {
                this.isReady = false;
                const bot = await Database.findBot(this.userId);
                if (bot) {
                    await Database.updateBot(bot.id, { status: 'disconnected' });
                }
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
        
        const user = await Database.findUserByPhone(senderNumber);
        if (!user) {
            await message.reply('❌ You are not registered.');
            return;
        }

        const reportCost = parseInt(process.env.REPORT_COST) || 10;
        if (user.coins < reportCost) {
            await message.reply(
                `❌ Insufficient coins! Need ${reportCost} coins, have ${user.coins}`
            );
            return;
        }

        // Deduct coins
        const newCoins = user.coins - reportCost;
        await Database.updateUser(user.id, { coins: newCoins });

        // Create report
        await Database.createReport({
            reporterId: user.id,
            targetNumber: targetNumber,
            status: 'pending'
        });

        // Get all active bots
        const bots = await Database.getBots();
        const activeBots = bots.filter(b => b.status === 'connected');

        await message.reply(
            `✅ Report sent for ${targetNumber}!\n` +
            `📊 Active Bots: ${activeBots.length}\n` +
            `🪙 Remaining Coins: ${newCoins}`
        );
    }

    async handleBalance(message) {
        const senderNumber = message.from.replace('@c.us', '');
        const user = await Database.findUserByPhone(senderNumber);
        
        if (!user) {
            await message.reply('❌ You are not registered.');
            return;
        }

        const reports = await Database.getUserReports(user.id);

        await message.reply(
            `💰 Your Balance\n\n` +
            `🪙 Coins: ${user.coins || 0}\n` +
            `📊 Total Reports: ${reports.length}`
        );
    }

    async handleHelp(message) {
        await message.reply(
            `🤖 WhatsApp Report Bot\n\n` +
            `.report <number> - Report a number (${process.env.REPORT_COST || 10} coins)\n` +
            `.balance - Check your balance\n` +
            `.help - Show this help\n\n` +
            `📱 Website: ${process.env.WEBSITE_URL}`
        );
    }
}

module.exports = WhatsAppBot;
