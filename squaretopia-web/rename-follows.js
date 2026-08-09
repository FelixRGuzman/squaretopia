// ONE TIME RENAME
// Run with:  node rename-follows.js
//
// The friends table was built one directional, meaning a row said that one
// account had added another with no agreement from the other side. That is
// following, not friendship, so the table, its columns and its constraints get
// renamed to say what they actually do.
//
// This only renames things. No rows are added, changed or deleted.
//
// Every step checks the current state before it runs, so this can be run more
// than once and can also pick up in the middle if an earlier run stopped part
// way through. MySQL will not rename a column that a check constraint refers to,
// so the constraints have to come off first and go back on at the end.

require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'squaretopia_db',
    waitForConnections: true,
    connectionLimit: 10
}).promise();

const DB_NAME = 'squaretopia_db';

async function tableExists(name) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS n FROM information_schema.tables
         WHERE table_schema = ? AND table_name = ?`,
        [DB_NAME, name]
    );
    return rows[0].n > 0;
}

async function columnExists(table, column) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
        [DB_NAME, table, column]
    );
    return rows[0].n > 0;
}

async function constraintExists(table, name) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS n FROM information_schema.table_constraints
         WHERE table_schema = ? AND table_name = ? AND constraint_name = ?`,
        [DB_NAME, table, name]
    );
    return rows[0].n > 0;
}

async function indexExists(table, name) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS n FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
        [DB_NAME, table, name]
    );
    return rows[0].n > 0;
}

async function rename() {
    try {
        console.log('-----------------------------------------');

        // Step 1. The table itself.
        if (await tableExists('friends')) {
            const [before] = await db.query('SELECT COUNT(*) AS n FROM friends');
            console.log(`Renaming friends -> follows, keeping ${before[0].n} existing row(s).`);
            await db.query('RENAME TABLE friends TO follows');
        } else if (await tableExists('follows')) {
            console.log('Table is already named follows.');
        } else {
            console.log('Neither a friends nor a follows table was found. Run schema.sql instead.');
            return;
        }

        // Step 2. Take the check constraint off.
        // MySQL refuses to rename a column while a check constraint mentions it,
        // so this has to come off before the columns can change.
        if (await constraintExists('follows', 'chk_friends_not_self')) {
            console.log('Dropping the old check constraint ...');
            await db.query('ALTER TABLE follows DROP CHECK chk_friends_not_self');
        }

        // Step 3. Take the foreign keys off.
        // They would survive a column rename, but their names still say friends,
        // so they get dropped here and put back with matching names at the end.
        if (await constraintExists('follows', 'fk_friends_user')) {
            console.log('Dropping the old foreign keys ...');
            await db.query('ALTER TABLE follows DROP FOREIGN KEY fk_friends_user');
        }
        if (await constraintExists('follows', 'fk_friends_friend')) {
            await db.query('ALTER TABLE follows DROP FOREIGN KEY fk_friends_friend');
        }

        // Step 4. The columns.
        if (await columnExists('follows', 'user_id')) {
            console.log('Renaming user_id -> follower_id ...');
            await db.query('ALTER TABLE follows RENAME COLUMN user_id TO follower_id');
        }
        if (await columnExists('follows', 'friend_id')) {
            console.log('Renaming friend_id -> following_id ...');
            await db.query('ALTER TABLE follows RENAME COLUMN friend_id TO following_id');
        }

        // Step 5. The leftover index from the dropped foreign key.
        if (await indexExists('follows', 'fk_friends_friend')) {
            console.log('Renaming the leftover index ...');
            await db.query('ALTER TABLE follows RENAME INDEX fk_friends_friend TO fk_follows_following');
        }

        // Step 6. Put the foreign keys back under their new names.
        if (!(await constraintExists('follows', 'fk_follows_follower'))) {
            console.log('Adding the foreign keys back ...');
            await db.query(`ALTER TABLE follows
                ADD CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id)
                REFERENCES users(id) ON DELETE CASCADE`);
        }
        if (!(await constraintExists('follows', 'fk_follows_following'))) {
            await db.query(`ALTER TABLE follows
                ADD CONSTRAINT fk_follows_following FOREIGN KEY (following_id)
                REFERENCES users(id) ON DELETE CASCADE`);
        }

        // Step 7. Put the check constraint back.
        if (!(await constraintExists('follows', 'chk_follows_not_self'))) {
            console.log('Adding the check constraint back ...');
            await db.query(`ALTER TABLE follows
                ADD CONSTRAINT chk_follows_not_self CHECK (follower_id <> following_id)`);
        }

        const [after] = await db.query('SELECT COUNT(*) AS n FROM follows');

        console.log('-----------------------------------------');
        console.log(`Done. The follows table holds ${after[0].n} row(s).`);
        console.log('Run SHOW CREATE TABLE follows; in MySQL to check the result.');
        console.log('-----------------------------------------');
    } catch (err) {
        console.error('Rename failed:', err.message);
        console.error('Nothing was deleted. Fix the error above and run this again,');
        console.error('it will pick up from wherever it stopped.');
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

rename();