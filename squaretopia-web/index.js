// Squaretopia web server.
// This file just starts the server and wires the pieces together, the actual
// routes live in the routes folder so this does not grow into one long file (also proper development practice)

require('dotenv').config();

const express = require('express');
const { PORT } = require('./config');
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');

// Stops right away if the token secret is missing rather than starting up and
// signing tokens with nothing. Keeping the secret in .env instead of in the
// source is the practifce carried over from CS 465.

if (!process.env.JWT_SECRET) {
    console.error("-----------------------------------------");
    console.error("JWT_SECRET is missing from your .env file.");
    console.error("Add a line like: JWT_SECRET=some_long_random_string");
    console.error("-----------------------------------------");
    process.exit(1);
}

const app = express();

// Let the server read JSON request bodies, and serve the login page and any
// other files sitting in the public folder.

app.use(express.json());
app.use(express.static('public'));

// Both groups of routes sit under /api, so the paths the dashboard and the Rust
// client already use do not change.

app.use('/api', authRoutes);
app.use('/api', playerRoutes);

// Start the server and listen for requests.

app.listen(PORT, () => {
    console.log("-----------------------------------------");
    console.log(`SQUARETOPIA WEB READY: http://localhost:${PORT}`);
    console.log("-----------------------------------------");
});
