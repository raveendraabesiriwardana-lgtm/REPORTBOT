// server.js - Session config එක වෙනස් කරන්න

// මෙය remove කරන්න:
// app.use(session({
//     secret: process.env.SESSION_SECRET || 'default_secret',
//     resave: false,
//     saveUninitialized: true,
//     cookie: { secure: process.env.NODE_ENV === 'production' }
// }));

// මෙය add කරන්න (JSON database session store):
const session = require('express-session');
const FileStore = require('session-file-store')(session);

app.use(session({
    store: new FileStore({
        path: './sessions/sessions',
        ttl: 86400, // 1 day
        retries: 0
    }),
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 86400000 // 1 day
    }
}));
