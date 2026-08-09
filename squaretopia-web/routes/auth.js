// Account routes: registering and logging in.
// Both of these now use the salted hashing and the login token carried over from
// my CS 465 project, instead of storing and comparing plain text passwords.

const express = require('express');
const db = require('../db');
const { DEFAULT_COLOR, DEFAULT_BIO, MIN_PASSWORD_LENGTH } = require('../config');
const { setPassword, validPassword, generateJWT } = require('../models/user');
const index = require('../search/hashtable');

const router = express.Router();

// REGISTER
// Creates an account across the two tables, credentials in users and the display
// side in profiles.

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[Register] Attempt: ${username}`);

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    // Letters, numbers and underscores only, which also means a username can
    // never contain characters that would matter when it is displayed later.

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({
            error: "Usernames must be 3-20 characters, letters, numbers and underscores only."
        });
    }

    // Guest is what the client calls a player who launched without logging in, so
    // nobody gets to register a name that would let them pose as one.

    if (username.toUpperCase().startsWith("GUEST")) {
        return res.status(400).json({ error: "That username is reserved." });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
            error: `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`
        });
    }

    let connection;
    try {

// Two inserts have to either both or neither happen, otherwise a failure halfway would leave an account with no profile.
// The transaction is what gives us that, and it is something the older table never needed because everything was one row.

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existing] = await connection.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: "Username already taken." });
        }

        // The password is turned into a hash and a salt here. 
        // What goes into the database cannot be turned back into the password.

        const { hash, salt } = setPassword(password);

        const [result] = await connection.query(
            'INSERT INTO users (username, hash, salt) VALUES (?, ?, ?)',
            [username, hash, salt]
        );

        await connection.query(
            'INSERT INTO profiles (user_id, color, bio) VALUES (?, ?, ?)',
            [result.insertId, DEFAULT_COLOR, DEFAULT_BIO]
        );

        await connection.commit();

        // Keep the search index matching the database.
        index.upsertPlayer(username, DEFAULT_COLOR, DEFAULT_BIO);

        console.log(`[Register] Success: ${username}`);
        res.json({ success: true });
    } catch (err) {
        if (connection) await connection.rollback();

        // The unique index on username is the real guard against duplicates. 
        // Two people registering the same name at the same moment would both pass the check above.
        // But the database is what actually stops the second one.

        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Username already taken." });
        }

        console.error("[Register] DB error:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
});

// LOGIN
// Looks the account up by name only, then checks the password by hashing what was typed and comparing. 
// The old version asked the database to match the password directly, which only worked because it was there in plain text.

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    try {
        const [rows] = await db.query(
            `SELECT u.id, u.username, u.hash, u.salt, p.color
             FROM users u
             JOIN profiles p ON p.user_id = u.id
             WHERE u.username = ?`,
            [username]
        );

    // Same message whether the account does not exist or the password was wrong. 
    // So nobody can use the login box to find out which usernames are real.

        if (rows.length === 0 || !validPassword(password, rows[0].hash, rows[0].salt)) {
            console.log(`[Login] Failed: ${username}`);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = rows[0];

    // The browser gets a signed token instead of just its own username. 
    // Also fixes the finding in my code review where the site stored a claim by the user rather than serversided proof. 

        const token = generateJWT(user);

        console.log(`[Login] Authorized: ${user.username}`);
        res.json({ username: user.username, color: user.color, token: token });
    } catch (err) {
        console.error("[Login] DB error:", err.message);
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;
