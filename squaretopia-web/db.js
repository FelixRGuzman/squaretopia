// The database connection pool, now in its own file so every route shares one
// pool instead of each part of the server opening its own.

// Loads the database password from .env so it is not written in the source.
require('dotenv').config();

const mysql = require('mysql2');

// A pool keeps a set of reusable connections open instead of opening a new one per request. 
// The password comes from .env, everything else points at the local squaretopia_db database.

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'squaretopia_db',
    waitForConnections: true,
    connectionLimit: 10
}).promise();

module.exports = db;
