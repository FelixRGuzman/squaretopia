// Squaretopia web server.
// This file just starts the server and wires the pieces together, the actual
// routes live in the routes folder so this does not grow into one long file (also proper development practice)

const express = require('express');
const { PORT } = require('./config');
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');

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
