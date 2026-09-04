// backend/whatsapp/bot.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { User, Bot, Report, Transaction } = require('../database/models');

class WhatsAppBot {
    constructor(userId) {
        this.userId = userId;
        this.client = null;
        this.isReady = false;
        this.botSession = null;
    }

    async initialize() {
        try {
            // Create session directory if not exists
            const sessionPath = `./whatsapp/session/bot-${this.userId}`;
            
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

            // QR Code event
            this.client.on('qr', async (qr) => {
                console.log(`📱 QR Code generated for user ${this.userId}`);
                qrcode.generate(qr, { small: true });
                
                // Save QR to database
                await Bot.findOneAndUpdate(
                    { userId: this.userId },
                    { qrCode: qr, status: 'awaiting_scan' }
                );
            });

            // Ready event
            this.client.on('ready', async () => {
                console.log(`✅ Bot ready for user ${this.userId}`);
                this.isReady = true;
                
                await Bot.findOneAndUpdate(
                    { userId: this.userId },
                    { 
                        status: 'connected',
                        lastActive: new Date()
                    }
                );
                
                // Start listening for messages
                this.setupMessageHandler();
            });

            // Message handler
            this.client.on('message', async (message) => {
                await this.handleMessage(message);
            });

            // Authentication success
            this.client.on('authenticated', () => {
                console.log(`🔐 Authenticated for user ${this.userId}`);
            });

            // Auth failure
            this.client.on('auth_failure', (msg) => {
                console.error(`❌ Auth failed: ${msg}`);
                this.isReady = false;
            });

            // Disconnected
            this.client.on('disconnected', async (reason) => {
                console.log(`⚠️ Bot disconnected: ${reason}`);
                this.isReady = false;
                await Bot.findOneAndUpdate(
                    { userId: this.userId },
                    { status: 'disconnected' }
                );
            });

            // Initialize client
            await this.client.initialize();
            
        } catch (error) {
            console.error('Error initializing bot:', error);
            throw error;
        }
    }

    async setupMessageHandler() {
        console.log('📨 Message handler setup complete');
    }

    async handleMessage(message) {
        try {
            // Check if message is a command
            if (!message.body.startsWith('.')) return;

            const parts = message.body.split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1);

            // .report command
            if (command === '.report') {
                await this.handleReportCommand(message, args);
            }
            
            // .balance command
            else if (command === '.balance') {
                await this.handleBalanceCommand(message);
            }
            
            // .help command
            else if (command === '.help') {
                await this.handleHelpCommand(message);
            }

        } catch (error) {
            console.error('Error handling message:', error);
            await message.reply('❌ An error occurred while processing your request.');
        }
    }

    async handleReportCommand(message, args) {
        if (args.length < 1) {
            await message.reply('❌ Usage: .report <phone_number>');
            return;
        }

        const targetNumber = args[0];
        const senderNumber = message.from.replace('@c.us', '');
        
        // Find user by phone number
        const user = await User.findOne({ phone: senderNumber });
        if (!user) {
            await message.reply('❌ You are not registered. Please sign up first.');
            return;
        }

        // Check coins
        if (user.coins < 10) {
            await message.reply(`❌ Insufficient coins! You need 10 coins. You have ${user.coins} coins.`);
            return;
        }

        // Deduct coins
        user.coins -= 10;
        await user.save();

        // Create transaction record
        await new Transaction({
            userId: user._id,
            type: 'spend',
            amount: 10,
            description: `Report on ${targetNumber}`
        }).save();

        // Create report
        const bot = await Bot.findOne({ userId: user._id });
        const report = new Report({
            reportedNumber: targetNumber,
            reporterId: user._id,
            botId: bot ? bot._id : null,
            status: 'pending'
        });
        await report.save();

        // Get all active bots
        const activeBots = await Bot.find({ status: 'connected' });
        const totalBots = activeBots.length;

        // Send report to all bots (in production, this would broadcast)
        // For now, we'll just acknowledge

        await message.reply(
            `✅ Report sent for ${targetNumber}!\n\n` +
            `📊 Active Bots: ${totalBots}\n` +
            `🪙 Remaining Coins: ${user.coins}\n` +
            `📈 Total Reports: ${await Report.countDocuments({ reporterId: user._id })}`
        );

        // Update bot stats
        if (bot) {
            bot.totalReports += 1;
            bot.activeUsers = totalBots;
            await bot.save();
        }
    }

    async handleBalanceCommand(message) {
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

    async handleHelpCommand(message) {
        await message.reply(
            `🤖 WhatsApp Report Bot Commands\n\n` +
            `.report <number> - Report a number (10 coins)\n` +
            `.balance - Check your balance\n` +
            `.help - Show this help message\n\n` +
            `💡 Visit our website to add more coins and manage your bot.`
        );
    }

    async sendReportToBots(targetNumber, reporterId) {
        // This would send the report to all connected bots
        // Implementation depends on your architecture
        console.log(`📨 Sending report for ${targetNumber} to all bots`);
        
        // In production, you'd use a message queue or broadcast system
        // For now, we'll just log it
    }

    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
        }
    }

    async getStatus() {
        const bot = await Bot.findOne({ userId: this.userId });
        return {
            isReady: this.isReady,
            status: bot ? bot.status : 'not_found',
            totalReports: bot ? bot.totalReports : 0,
            activeUsers: bot ? bot.activeUsers : 0
        };
    }
}

module.exports = WhatsAppBot;
