// DATABASE MIGRATION
// Run once with:  node migrate.js (old dataset to new schema)

require('dotenv').config();
const mysql = require('mysql2');
const { setPassword } = require('./models/user');
const { DEFAULT_COLOR, DEFAULT_BIO } = require('./config');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'squaretopia_db',
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: false
}).promise();

async function tableExists(name) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS n FROM information_schema.tables
         WHERE table_schema = 'squaretopia_db' AND table_name = ?`,
        [name]
    );
    return rows[0].n > 0;
}

async function migrate() {
    try {
        console.log('-----------------------------------------');
        console.log('SQUARETOPIA DATABASE MIGRATION');
        console.log('-----------------------------------------');

        if (await tableExists('users_legacy')) {
            console.log('users_legacy already exists, so this migration has already been run.');
            console.log('Nothing to do.');
            return;
        }

        if (!(await tableExists('users'))) {
            console.log('No users table found. Nothing to migrate.');
            return;
        }

        const [oldUsers] = await db.query('SELECT * FROM users');
        console.log(`Found ${oldUsers.length} account(s) in the old table.`);

        console.log('Renaming users -> users_legacy ...');
        await db.query('RENAME TABLE users TO users_legacy');

        console.log('Creating users table ...');
        await db.query(`
            CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(32) NOT NULL,
                hash CHAR(128) NOT NULL,
                salt CHAR(32) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_users_username (username)
            ) ENGINE=InnoDB
        `);

        console.log('Creating profiles table ...');
        await db.query(`
            CREATE TABLE profiles (
                user_id INT PRIMARY KEY,
                color VARCHAR(7) NOT NULL DEFAULT '${DEFAULT_COLOR}',
                bio VARCHAR(200) NOT NULL DEFAULT '${DEFAULT_BIO}',
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_profiles_user FOREIGN KEY (user_id)
                    REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        console.log('Creating friends table ...');
        await db.query(`
            CREATE TABLE friends (
                user_id INT NOT NULL,
                friend_id INT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, friend_id),
                CONSTRAINT fk_friends_user FOREIGN KEY (user_id)
                    REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_friends_friend FOREIGN KEY (friend_id)
                    REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT chk_friends_not_self CHECK (user_id <> friend_id)
            ) ENGINE=InnoDB
        `);


        let moved = 0;
        let skipped = 0;

        for (const old of oldUsers) {
            if (!old.username || !old.password) {
                console.log(`  skipping row ${old.id}, missing username or password`);
                skipped++;
                continue;
            }

            const { hash, salt } = setPassword(old.password);

            const [result] = await db.query(
                'INSERT INTO users (username, hash, salt) VALUES (?, ?, ?)',
                [old.username, hash, salt]
            );

            await db.query(
                'INSERT INTO profiles (user_id, color, bio) VALUES (?, ?, ?)',
                [
                    result.insertId,
                    old.color || DEFAULT_COLOR,
                    (old.bio && old.bio.trim().length > 0) ? old.bio : DEFAULT_BIO
                ]
            );

            console.log(`  migrated ${old.username}`);
            moved++;
        }

        console.log('-----------------------------------------');
        console.log(`Done. Migrated ${moved} account(s), skipped ${skipped}.`);
        console.log('Everyone keeps the same password they already had, it is just stored safely now.');
        console.log('The old table is still there as users_legacy if you need to look at it.');
        console.log('-----------------------------------------');
    } catch (err) {
        console.error('Migration failed:', err.message);
        console.error('Nothing was deleted. Check that MySQL is running and squaretopia_db exists.');
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

migrate();
