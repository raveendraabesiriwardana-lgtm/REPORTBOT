// database.js - JSON Database
const { JsonDB } = require('node-json-db');
const { Config } = require('node-json-db/dist/lib/JsonDBConfig');
const path = require('path');
const fs = require('fs');

// Database folder create කරන්න
const dbFolder = path.join(__dirname, 'database');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
    console.log('📁 Database folder created');
}

// Database file path
const dbPath = path.join(dbFolder, 'data.json');

// Initialize database
const db = new JsonDB(new Config(dbPath, true, false, '/'));

// Database operations
const Database = {
    // User operations
    async createUser(userData) {
        const users = await this.getUsers();
        const newUser = {
            id: Date.now().toString(),
            ...userData,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        await db.push('/users', users);
        return newUser;
    },

    async getUsers() {
        try {
            return await db.getData('/users') || [];
        } catch (error) {
            return [];
        }
    },

    async findUser(query) {
        const users = await this.getUsers();
        return users.find(user => {
            for (let key in query) {
                if (user[key] !== query[key]) return false;
            }
            return true;
        });
    },

    async findUserByEmail(email) {
        const users = await this.getUsers();
        return users.find(user => user.email === email);
    },

    async findUserByPhone(phone) {
        const users = await this.getUsers();
        return users.find(user => user.phone === phone);
    },

    async findUserById(id) {
        const users = await this.getUsers();
        return users.find(user => user.id === id);
    },

    async updateUser(id, updateData) {
        const users = await this.getUsers();
        const index = users.findIndex(user => user.id === id);
        if (index === -1) return null;
        users[index] = { ...users[index], ...updateData };
        await db.push('/users', users);
        return users[index];
    },

    async deleteUser(id) {
        const users = await this.getUsers();
        const filteredUsers = users.filter(user => user.id !== id);
        await db.push('/users', filteredUsers);
        return true;
    },

    // Bot operations
    async createBot(botData) {
        const bots = await this.getBots();
        const newBot = {
            id: Date.now().toString(),
            ...botData,
            createdAt: new Date().toISOString(),
            status: 'disconnected'
        };
        bots.push(newBot);
        await db.push('/bots', bots);
        return newBot;
    },

    async getBots() {
        try {
            return await db.getData('/bots') || [];
        } catch (error) {
            return [];
        }
    },

    async findBot(userId) {
        const bots = await this.getBots();
        return bots.find(bot => bot.userId === userId);
    },

    async findBotById(id) {
        const bots = await this.getBots();
        return bots.find(bot => bot.id === id);
    },

    async updateBot(id, updateData) {
        const bots = await this.getBots();
        const index = bots.findIndex(bot => bot.id === id);
        if (index === -1) return null;
        bots[index] = { ...bots[index], ...updateData };
        await db.push('/bots', bots);
        return bots[index];
    },

    // Report operations
    async createReport(reportData) {
        const reports = await this.getReports();
        const newReport = {
            id: Date.now().toString(),
            ...reportData,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        reports.push(newReport);
        await db.push('/reports', reports);
        return newReport;
    },

    async getReports() {
        try {
            return await db.getData('/reports') || [];
        } catch (error) {
            return [];
        }
    },

    async getUserReports(userId) {
        const reports = await this.getReports();
        return reports.filter(report => report.reporterId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async getBotReports(botId) {
        const reports = await this.getReports();
        return reports.filter(report => report.botId === botId);
    },

    async updateReport(id, updateData) {
        const reports = await this.getReports();
        const index = reports.findIndex(report => report.id === id);
        if (index === -1) return null;
        reports[index] = { ...reports[index], ...updateData };
        await db.push('/reports', reports);
        return reports[index];
    },

    // Transaction operations
    async createTransaction(transactionData) {
        const transactions = await this.getTransactions();
        const newTransaction = {
            id: Date.now().toString(),
            ...transactionData,
            createdAt: new Date().toISOString()
        };
        transactions.push(newTransaction);
        await db.push('/transactions', transactions);
        return newTransaction;
    },

    async getTransactions() {
        try {
            return await db.getData('/transactions') || [];
        } catch (error) {
            return [];
        }
    },

    async getUserTransactions(userId) {
        const transactions = await this.getTransactions();
        return transactions.filter(t => t.userId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    // Stats
    async getStats() {
        const users = await this.getUsers();
        const bots = await this.getBots();
        const reports = await this.getReports();
        const activeBots = bots.filter(b => b.status === 'connected');
        
        return {
            totalUsers: users.length,
            totalBots: bots.length,
            activeBots: activeBots.length,
            totalReports: reports.length,
            pendingReports: reports.filter(r => r.status === 'pending').length
        };
    },

    // Clear all data (for testing)
    async clearAll() {
        await db.push('/users', []);
        await db.push('/bots', []);
        await db.push('/reports', []);
        await db.push('/transactions', []);
        return true;
    }
};

module.exports = Database;
