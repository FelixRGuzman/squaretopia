require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Database connection pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'squaretopia_db',
    waitForConnections: true,
    connectionLimit: 10
}).promise();

// REGISTER
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[Register] Attempt: ${username}`);
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }
    try {
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "Username already taken." });
        }
        await db.query(
            'INSERT INTO users (username, password, color) VALUES (?, ?, ?)',
            [username, password, '#3498db']
        );
        console.log(`[Register] Success: ${username}`);
        res.json({ success: true });
    } catch (err) {
        console.error("[Register] DB error:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

//  LOGIN 
app.post('/api/login', async (req, res) => {
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

//  PLAYER PROFILE (the route the Rust client calls)
app.get('/api/player/:username', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT username, color FROM users WHERE username = ?',
            [req.params.username]
        );
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log("-----------------------------------------");
    console.log("SQUARETOPIA WEB READY: http://localhost:3000");
    console.log("-----------------------------------------");
});