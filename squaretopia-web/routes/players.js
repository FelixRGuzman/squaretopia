// Player routes: profiles, searching, and the follow lists.
// Reading is open to anyone, the same way the trip list was public in CS 465.
// Anything that changes data goes through the token check first.

const express = require('express');
const db = require('../db');
const { MAX_SEARCH_TERM_LENGTH, MAX_BIO_LENGTH, DEFAULT_COLOR } = require('../config');
const index = require('../search/hashtable');
const authenticateJWT = require('../middleware/auth');

const router = express.Router();

// Loads every account into the hash table from Milestone Three.
// The join pulls the name from users and the display fields from profiles. The
// hash and salt columns are never selected, so credentials are not sitting in
// memory inside the search index at all.

async function rebuildIndex() {
    const [rows] = await db.query(
        `SELECT u.username, p.color, p.bio
         FROM users u
         JOIN profiles p ON p.user_id = u.id`
    );
    index.loadPlayers(rows);
}

rebuildIndex().catch(err => {
    console.error("[Index] Could not build player index:", err.message);
});

// UPDATE COLOR
// The username is taken from the token, not from the request body, so this can
// only ever change the profile of whoever is actually logged in.
router.post('/update-profile', authenticateJWT, async (req, res) => {
    const username = req.auth.username;
    const { color } = req.body;

    // Only a real hex color goes into the database.
    if (!/^#[0-9a-fA-F]{6}$/.test(color || "")) {
        return res.status(400).json({ error: "That is not a valid color." });
    }

    try {
        const [result] = await db.query(
            `UPDATE profiles p
             JOIN users u ON u.id = p.user_id
             SET p.color = ?
             WHERE u.username = ?`,
            [color, username]
        );

// A valid token does not prove the account is still there. Tokens are
// // self contained and stay good until they expire, so one can outlive the row it points at if that account gets deleted. 
// If the update matched nothing then the account is gone, and we must not put it back into the search index.

        if (result.affectedRows === 0) {
            console.log(`[Profile] Token for missing account: ${username}`);
            return res.status(401).json({ error: "That account no longer exists." });
        }

        const player = index.searchPlayer(username);
        index.upsertPlayer(username, color, player ? player.bio : '');

        console.log(`[Profile] ${username} set color to ${color}`);
        res.json({ success: true });
    } catch (err) {
        console.error("[Profile] DB error:", err.message);
        res.status(500).json({ error: "DB Error" });
    }
});

// UPDATE BIO
router.post('/update-bio', authenticateJWT, async (req, res) => {
    const username = req.auth.username;
    const { bio } = req.body;

    if (typeof bio !== 'string') {
        return res.status(400).json({ error: "Bio is required." });
    }

    // Cut it off rather than reject it, a long bio is not an attack it is just long.
    const trimmedBio = bio.slice(0, MAX_BIO_LENGTH);

    try {
        const [result] = await db.query(
            `UPDATE profiles p
             JOIN users u ON u.id = p.user_id
             SET p.bio = ?
             WHERE u.username = ?`,
            [trimmedBio, username]
        );

        // Same check as the color route, a token can outlive its account.
        if (result.affectedRows === 0) {
            return res.status(401).json({ error: "That account no longer exists." });
        }

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
// Left public on purpose so the desktop client keeps working without changes,
// and because a color is not private information.

router.get('/player/:username', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.username, p.color
             FROM users u
             JOIN profiles p ON p.user_id = u.id
             WHERE u.username = ?`,
            [req.params.username]
        );
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PROFILE PAGE DATA
// Served out of the hash table, so this is the exact match lookup from CS 300.

router.get('/profile/:username', (req, res) => {
    const player = index.searchPlayer(req.params.username);

    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    res.json({
        username: player.username,
        color: player.color,
        bio: player.bio
    });
});

// SESSION CHECK
// Confirms the account behind this token still exists.
// Everything else the dashboard reads comes out of the in-memory index, so this
// is the one place that asks the database directly. It runs once per page load
// rather than per keystroke, which is why it is cheap enough to do this way.

router.get('/me', authenticateJWT, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id FROM users WHERE username = ?',
            [req.auth.username]
        );

        // A token stays valid on its own until it expires, so it can outlive the
        // row it points at if that account is gone.

        if (rows.length === 0) {
            console.log(`[Session] Token for missing account: ${req.auth.username}`);
            return res.status(401).json({ error: "That account no longer exists." });
        }

        res.json({ username: req.auth.username });
    } catch (err) {
        console.error("[Session] DB error:", err.message);
        res.status(500).json({ error: "DB Error" });
    }
});

// PLAYER SEARCH
// Still runs against the hash table, so nothing the user types reaches the database.

router.get('/search', (req, res) => {
    const rawTerm = req.query.q;

    if (typeof rawTerm !== 'string') {
        return res.status(400).json({ error: "Search term is required." });
    }

    const term = rawTerm.trim();

    if (term.length === 0) {
        return res.json({ query: "", count: 0, results: [] });
    }

    if (term.length > MAX_SEARCH_TERM_LENGTH) {
        return res.status(400).json({ error: "Search term is too long." });
    }

    const matches = index.searchPartial(term);
    const results = matches.map(p => ({ username: p.username, color: p.color }));

    console.log(`[Search] "${term}" returned ${results.length} result(s)`);
    res.json({ query: term, count: results.length, results: results });
});

// PLAYER DIRECTORY
router.get('/players', (req, res) => {
    const list = index.printPlayerList();
    res.json({
        count: list.length,
        players: list.map(p => ({ username: p.username, color: p.color }))
    });
});

// FOLLOWING
// Everyone this player has followed.
// This and the followers route below run against the same table and the same
// rows, the only difference is which column is being matched. 

router.get('/following/:username', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT target.username, p.color
             FROM follows f
             JOIN users me ON me.id = f.follower_id
             JOIN users target ON target.id = f.following_id
             JOIN profiles p ON p.user_id = target.id
             WHERE me.username = ?
             ORDER BY target.username ASC`,
            [req.params.username]
        );
        res.json({ count: rows.length, players: rows });
    } catch (err) {
        console.error("[Follows] DB error:", err.message);
        res.status(500).json({ error: "DB Error" });
    }
});

// FOLLOWERS
// Everyone who has followed this player. Same table as above, read the other way.
router.get('/followers/:username', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT source.username, p.color
             FROM follows f
             JOIN users me ON me.id = f.following_id
             JOIN users source ON source.id = f.follower_id
             JOIN profiles p ON p.user_id = source.id
             WHERE me.username = ?
             ORDER BY source.username ASC`,
            [req.params.username]
        );
        res.json({ count: rows.length, players: rows });
    } catch (err) {
        console.error("[Follows] DB error:", err.message);
        res.status(500).json({ error: "DB Error" });
    }
});

// FOLLOW
// Whoever the token says we are follows whoever we named.
router.post('/follow', authenticateJWT, async (req, res) => {
    const username = req.auth.username;
    const { target } = req.body;

    if (typeof target !== 'string' || target.trim().length === 0) {
        return res.status(400).json({ error: "Which player did you want to follow?" });
    }

    if (target.toUpperCase() === username.toUpperCase()) {
        return res.status(400).json({ error: "You cannot follow yourself." });
    }

    try {
        const [rows] = await db.query(
            'SELECT id, username FROM users WHERE username IN (?, ?)',
            [username, target]
        );

        const me = rows.find(r => r.username.toUpperCase() === username.toUpperCase());
        const them = rows.find(r => r.username.toUpperCase() === target.toUpperCase());

        if (!me) {
            return res.status(401).json({ error: "That account no longer exists." });
        }

        if (!them) {
            return res.status(404).json({ error: "That player does not exist." });
        }

        // The pair of ids is the primary key, so following the same person twice
        // So it's database refusing it rather than something we have to check for.

        await db.query(
            'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
            [me.id, them.id]
        );

        console.log(`[Follows] ${username} followed ${them.username}`);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "You already follow that player." });
        }
        console.error("[Follows] DB error:", err.message);
        res.status(500).json({ error: "DB Error" });
    }
});

// UNFOLLOW
router.post('/unfollow', authenticateJWT, async (req, res) => {
    const username = req.auth.username;
    const { target } = req.body;

    if (typeof target !== 'string') {
        return res.status(400).json({ error: "Which player did you want to unfollow?" });
    }

    try {
        await db.query(
            `DELETE f FROM follows f
             JOIN users me ON me.id = f.follower_id
             JOIN users target ON target.id = f.following_id
             WHERE me.username = ? AND target.username = ?`,
            [username, target]
        );

        console.log(`[Follows] ${username} unfollowed ${target}`);
        res.json({ success: true });
    } catch (err) {
        console.error("[Follows] DB error:", err.message);
        res.status(500).json({ error: "DB Error" });
    }
});

// FOLLOW STATUS
// Whether we already follow this player, and whether they follow us back. The
// second one is the same table joined to itself, which is how a mutual follow
// falls out of the data without ever being stored as its own thing.

router.get('/follow-status/:username', authenticateJWT, async (req, res) => {
    const username = req.auth.username;
    const target = req.params.username;

    try {
        const [rows] = await db.query(
            `SELECT
                EXISTS (
                    SELECT 1 FROM follows f
                    JOIN users a ON a.id = f.follower_id
                    JOIN users b ON b.id = f.following_id
                    WHERE a.username = ? AND b.username = ?
                ) AS iFollow,
                EXISTS (
                    SELECT 1 FROM follows f
                    JOIN users a ON a.id = f.follower_id
                    JOIN users b ON b.id = f.following_id
                    WHERE a.username = ? AND b.username = ?
                ) AS followsMe`,
            [username, target, target, username]
        );

        res.json({
            iFollow: rows[0].iFollow === 1,
            followsMe: rows[0].followsMe === 1
        });
    } catch (err) {
        console.error("[Follows] DB error:", err.message);
        res.status(500).json({ error: "DB Error" });
    }
});

module.exports = router;
module.exports.rebuildIndex = rebuildIndex;