// models.js - JSON Database එක use කරන්න
const Database = require('./database');

// Export Database as models
module.exports = {
    User: Database,
    Bot: Database,
    Report: Database,
    Transaction: Database,
    // For backward compatibility
    findUser: Database.findUser,
    findUserByEmail: Database.findUserByEmail,
    findUserByPhone: Database.findUserByPhone,
    findUserById: Database.findUserById,
    createUser: Database.createUser,
    updateUser: Database.updateUser,
    findBot: Database.findBot,
    createBot: Database.createBot,
    updateBot: Database.updateBot,
    createReport: Database.createReport,
    getUserReports: Database.getUserReports,
    getStats: Database.getStats
};
