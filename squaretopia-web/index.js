// Load the database password from the .env file into process.env so it is not
// written directly in this source file.
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const app = express();

// Let the server read JSON request bodies, and serve the login page and any
// other files sitting in the public folder.
app.use(express.json());
app.use(express.static('public'));

// The database connection pool.
// A pool keeps a set of reusable connections open instead of opening a new one
// per request. The password comes from .env, everything else points at the
// local squaretopia_db database.
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'squaretopia_db',
    waitForConnections: true,
    connectionLimit: 10
}).promise();

// REGISTER
// Creates a new account. Rejects missing fields, and rejects a username that
// is already taken so two accounts cannot share one name.
app.post('/api/register', async (req, res) => {
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
        // New accounts start with a default blue color until the user changes it.
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

// LOGIN
// Checks the username and password against the database.
// On success it returns the username and saved color, which the dashboard uses.
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

// UPDATE COLOR
// Saves the color the user picked on the dashboard back to their account, so
// the client can load it later.
app.post('/api/update-profile', async (req, res) => {
    const { username, color } = req.body;
    try {
        await db.query('UPDATE users SET color = ? WHERE username = ?', [color, username]);
        console.log(`[Profile] ${username} set color to ${color}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

// PLAYER PROFILE (the route the Rust client calls)
// When the client launches, it asks here for the logged-in user's username and
// color. Returns 404 if no such account exists, which the client treats as a guest.
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

// Start the server and listen for requests on port 3000.
app.listen(3000, () => {
    console.log("-----------------------------------------");
    console.log("SQUARETOPIA WEB READY: http://localhost:3000");
    console.log("-----------------------------------------");
});