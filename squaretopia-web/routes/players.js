// Player routes: saving a color and bio, handing a profile to the client, viewing
// a profile, and searching for other players.

const express = require('express');
const db = require('../db');
const { MAX_SEARCH_TERM_LENGTH, MAX_BIO_LENGTH, DEFAULT_COLOR } = require('../config');
const index = require('../search/hashtable');

const router = express.Router();

// Pulls every account out of MySQL and loads them into the hash table.
// The database is still the real source of truth, the table is just the fast copy
// we search against so a keystroke does not turn into a query.
async function rebuildIndex() {
    const [rows] = await db.query('SELECT username, color, bio FROM users');
    index.loadPlayers(rows);
}

// Build it once when the server starts.
rebuildIndex().catch(err => {
    console.error("[Index] Could not build player index:", err.message);
});

// UPDATE COLOR
// Saves the color the user picked on the dashboard back to their account, so
// the client can load it later.
router.post('/update-profile', async (req, res) => {
    const { username, color } = req.body;
    try {
        await db.query('UPDATE users SET color = ? WHERE username = ?', [color, username]);

        // Keep the table matching the database, otherwise a search would hand back
        // the old color until the next restart.
        const player = index.searchPlayer(username);
        index.upsertPlayer(username, color, player ? player.bio : '');

        console.log(`[Profile] ${username} set color to ${color}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

// UPDATE BIO
// Saves the short description a user writes about themselves.
router.post('/update-bio', async (req, res) => {
    const { username, bio } = req.body;

    if (typeof username !== 'string' || typeof bio !== 'string') {
        return res.status(400).json({ error: "Username and bio are required." });
    }

    // Cut it off rather than reject it, a long bio is not an attack it is just long.
    const trimmedBio = bio.slice(0, MAX_BIO_LENGTH);

    try {
        await db.query('UPDATE users SET bio = ? WHERE username = ?', [trimmedBio, username]);

        const player = index.searchPlayer(username);
        index.upsertPlayer(username, player ? player.color : DEFAULT_COLOR, trimmedBio);

        console.log(`[Profile] ${username} updated their bio`);
        res.json({ success: true, bio: trimmedBio });
    } catch (err) {
        console.error("[Bio] DB error:", err.message);
        res.status(500).json({ error: "DB Error" });
    }
});

// PLAYER PROFILE (the route the Rust client calls)
// When the client launches, it asks here for the logged-in user's username and
// color. Returns 404 if no such account exists, which the client treats as a guest.
router.get('/player/:username', async (req, res) => {
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

// PROFILE PAGE DATA
// What the profile page asks for when you click someone in the search results.
// This one goes through the hash table instead of the database, so it is the exact
// match lookup from CS 300 doing the work, just on usernames now.
router.get('/profile/:username', (req, res) => {
    const player = index.searchPlayer(req.params.username);

    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    // Only what a profile page needs. The password is not even in the table, so
    // there is nothing here that could leak it.
    res.json({
        username: player.username,
        color: player.color,
        bio: player.bio
    });
});

// PLAYER SEARCH
// Finds real accounts by username, now using the hash table carried over from my
// CS 300 advising program instead of asking MySQL to do the matching.
router.get('/search', (req, res) => {
    const rawTerm = req.query.q;

    // Anything that is not a string is not a search, so stop here.
    if (typeof rawTerm !== 'string') {
        return res.status(400).json({ error: "Search term is required." });
    }

    const term = rawTerm.trim();

    // An empty box is not an error, there is just nothing to look for yet.
    if (term.length === 0) {
        return res.json({ query: "", count: 0, results: [] });
    }

    if (term.length > MAX_SEARCH_TERM_LENGTH) {
        return res.status(400).json({ error: "Search term is too long." });
    }

    // The matching happens in memory now. Nothing the user typed ever reaches the
    // database, so the whole class of wildcard and injection problems that come with
    // building a LIKE pattern out of user input does not exist here anymore.
    const matches = index.searchPartial(term);

    const results = matches.map(p => ({ username: p.username, color: p.color }));

    console.log(`[Search] "${term}" returned ${results.length} result(s)`);
    res.json({ query: term, count: results.length, results: results });
});

// PLAYER DIRECTORY
// Every account in alphanumeric order, this is printCourseList from CS 300 doing
// the same job it always did, just with players in it now.

router.get('/players', (req, res) => {
    const list = index.printPlayerList();
    res.json({
        count: list.length,
        players: list.map(p => ({ username: p.username, color: p.color }))
    });
});

module.exports = router;
module.exports.rebuildIndex = rebuildIndex;