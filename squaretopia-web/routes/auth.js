// Account routes: registering and logging in.

const express = require('express');
const db = require('../db');
const { DEFAULT_COLOR, DEFAULT_BIO } = require('../config');
const index = require('../search/hashtable');

const router = express.Router();

// REGISTER
// Creates a new account. Rejects missing fields, and rejects a username that
// is already taken so two accounts cannot share one name.
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[Register] Attempt: ${username}`);
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }
    try {
        // The ? placeholders let the driver insert the values safely instead of
        // pasting them straight into the SQL, which prevents SQL injection.
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "Username already taken." });
        }
        await db.query(
            'INSERT INTO users (username, password, color, bio) VALUES (?, ?, ?, ?)',
            [username, password, DEFAULT_COLOR, DEFAULT_BIO]
        );

        // Put the new account straight into the hash table instead of rebuilding
        // the whole thing, one new player does not justify reloading everyone.
        index.upsertPlayer(username, DEFAULT_COLOR, DEFAULT_BIO);

        console.log(`[Register] Success: ${username}`);
        res.json({ success: true });
    } catch (err) {
        console.error("[Register] DB error:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// LOGIN
// Checks the username and password against the database.
// On success it returns the username and saved color, which the dashboard uses.
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query(
            'SELECT username, color FROM users WHERE username = ? AND password = ?',
            [username, password]
        );
        if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
        console.log(`[Login] Authorized: ${username}`);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;
