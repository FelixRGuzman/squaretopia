--======================================================================================================
-- Squaretopia database schema
-- Felix Guzman, CS 499 Capstone, Enhancement Three (Databases)

-- Builds the database from nothing. This is to run it once on a machine that has never had
-- Squaretopia on it, use the following:

-- mysql -u root -p < schema.sql

-- This is not the same job as migrate.js. That is an older script for converting an
-- existing install off the old single table design and hashing the passwords it
-- finds there. This file is for a fresh start where there is nothing to convert.

-- The order below matters. profiles and follows both point at users, and a
-- foreign key cannot reference a table that does not exist yet, so users has to be created first.
--=======================================================================================================

CREATE DATABASE IF NOT EXISTS squaretopia_db;
USE squaretopia_db;


---------------------------------------------------------------------------
-- users
-- Credentials only.

-- There is no password column here, which is the whole point. Only the hash and
-- the salt are stored, the same shape as the user schema in my CS 465 project.
-- Nothing in this table can be turned back into somebody's password.

-- The lengths are not arbitrary. PBKDF2 gives back 64 bytes, which is 128
-- characters once it is written as hex, and the salt is 16 random bytes, which
-- is 32. CHAR rather than VARCHAR because every row is exactly that long.

-- The unique index on username is what actually makes duplicate names
-- impossible. The register route checks too, but two people registering the same
-- name at the same moment would both pass that check, and this is what stops the
-- second one.
---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(32) NOT NULL,
    hash        CHAR(128) NOT NULL,
    salt        CHAR(32) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;


---------------------------------------------------------------------------
-- profiles
-- The display side of an account, one row per user.

-- Kept apart from users on purpose. The search index and every public profile
-- page read from here, so a route that only needs somebody's color never has to
-- touch the table holding the hashes.

-- user_id is both the primary key and the foreign key, which is what makes this
-- one profile per account rather than many. ON DELETE CASCADE means removing an
-- account takes its profile with it, so there is no way to end up with a profile
-- belonging to nobody. In my code review I said this was the thing MongoDB could
-- not do for me and that I would have to remember to clean up by hand. Here the
-- database does it.
---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
    user_id     INT PRIMARY KEY,
    color       VARCHAR(7) NOT NULL DEFAULT '#3498db',
    bio         VARCHAR(200) NOT NULL DEFAULT 'This player has not written a bio yet.',
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


---------------------------------------------------------------------------
-- follows
-- Players following other players.

-- Both columns point back at the same users table, which is the relationship I
-- said in my code review that documents were the wrong shape for. A follow is
-- not data that belongs inside one player's record, it is a link between two.

-- The primary key is the pair rather than a single column, so the same follow
-- cannot be stored twice. The check constraint stops anyone following
-- themselves. So deleting an account clears every follow it was part of, in either 
-- direction, without the application having to go looking for them.

-- Reading these rows one way gives the people somebody follows, and matching on
-- the other column instead gives the people who follow them. Same rows, two
-- opposite questions.
---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS follows (
    follower_id   INT NOT NULL,
    following_id  INT NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (follower_id, following_id),

    CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id)
        REFERENCES users(id) ON DELETE CASCADE,

    CONSTRAINT fk_follows_following FOREIGN KEY (following_id)
        REFERENCES users(id) ON DELETE CASCADE,

    CONSTRAINT chk_follows_not_self CHECK (follower_id <> following_id)
) ENGINE=InnoDB;


-- To check that everything was created as expected...

SHOW TABLES;