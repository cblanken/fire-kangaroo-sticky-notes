const express = require("express");
const session = require("express-session");
require("dotenv").config({ path: './config/.env' });
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const cors = require("cors");
const User = require("./models/User");

/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport');
const { ensureAuth, ensureGuest } = require("./controllers/auth");


const app = express()

/**
 * Connect to MongoDB.
 */
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on('error', (err) => {
    console.error(err);
    console.log('%s MongoDB connection error. Please make sure MongoDB is running.');
    process.exit();
});

const PORT = process.env.PORT || 8000;
const MODE = process.env.NODE_ENV || "development"


// // Express config
// let whitelist = [process.env.FRONTEND_URL, process.env.BASE_URL]
// console.log("whitelist:", whitelist)
// let corsOptions = {
//     credentials: true,
//     methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD", "DELETE"],
//     origin: function(origin, callback) {
//         console.log("ORIGIN:", origin)
//         if (whitelist.indexOf(origin) !== -1) {
//             callback(null, true)
//         } else {
//             callback(new Error('Not allowed by CORS'))
//         }
//     },
// }

// // app.use(cors(corsOptions))
// app.use(cors())

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", `http://localhost:3000`)
    res.header("Access-Control-Allow-Credentials", true)
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    next();
})

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
    cookie: { maxAge: 1209600000 }, // Two weeks in milliseconds
    store: MongoStore.create({
        client: mongoose.connection.getClient(),
    }),
    cookie: { secure: false }
}));

// Passport init
app.use(passport.initialize())
app.use(passport.session())

// OAuth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], accessType: 'offline', prompt: 'consent' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login` }), (req, res) => {
    res.redirect(req.session.returnTo || `${process.env.FRONTEND_URL}`);
});

app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: `${process.env.FRONTEND_URL}/login` }), (req, res) => {
    res.redirect(req.session.returnTo || `${process.env.FRONTEND_URL}`);
});

// Router(s) config
app.use('/api', require("./routes/api"))

app.get('/authenticated', (req, res, next) => {
    return res.json({ "auth": req.isAuthenticated() })
});

app.post(
    '/login',
    passport.authenticate('local', { failureMessage: true, successMessage: true}),
    function(req, res, next) {
        res.json("LOGIN SUCCESS")
    }
);

app.post('/logout', function(req, res) {
    req.logout(err => {
        if (err) { return nex(err) }
        res.clearCookie('connect.sid', {
            path: '/',
            domain: 'localhost',
            // secure: false,
            // httpOnly: true,
            // sameSite: true,
        }).send(); 
    });
});

app.post('/signup', async(req, res) => {
    const { email, password } = req.body;

    console.log("SIGNUP", email, password)

    const user = await User.findOne({ email: email });

    // Confirm user doesn't already exist
    if (user) {
        return res.status(401).json({ error: 'A user account with that email already exists' });
    }

    req.session.user = await User.create({
        email: email,
        password: password
    })
    return res.json({ message: 'Signup successful' });
});

app.use((err, req, res, next) => {
    if (err && err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Username and password do not match' });
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Starting server on port ${PORT} in ${MODE} mode`);
})