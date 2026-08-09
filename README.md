# Squaretopia
 
## About this project
 
Squaretopia is the CS 499 capstone enhancement of an earlier prototype called Pixgate. The original Pixgate client was written in the Godot engine using GDScript. This project contains three enhancements across the areas of software design and engineering, data structures and algorithms, and finally databases.
 
We tackle the Software Design and Engineering enhancement in Milestone Two. In this milestone the client is rewritten in Rust with the Bevy engine, the website-to-client data handoff is rebuilt, and the original's hardcoded paths and missing documentation are addressed to some extent.
 
We tackle the Algorithms and Data Structures enhancement in Milestone Three. In this milestone the hash table from my CS 300 advising program is rebuilt in JavaScript inside the backend, where it powers a player search that resizes itself as more accounts are added.
 
We tackle the Databases enhancement in Milestone Four. In this milestone the single flat users table is replaced with a real relational schema, and the salted password hashing and token based login are carried over from my CS 465 project.
 
Log in on a website, pick a color for your square, and launch a desktop game that opens as you in that color. The project has two parts:
 
- **squaretopia-web**: the website and login page (Node.js + Express + MySQL).
- **squaretopia-client**: the desktop game (Rust + Bevy).
  
## What was built (Milestone Two, built by 7/25/2026)
 
- A Node.js and Express backend on a local MySQL database, with routes to register, log in, save a color, and return a player's profile.
- A browser login page and dashboard for picking and saving a color.
- A Rust and Bevy game client that reads which user launched it, fetches that user's saved color from the backend, validates the response, and draws the player's square with a name label.
- The full website-to-client handoff over a custom `squaretopia://` link, so logging in and clicking Launch opens the game as that user in their color.
- A guest mode, so opening the client directly gives a clearly labeled guest instead of a fake account.
This is intentionally a pseudo single-player build. It sends and receives real data from the website but does not yet include real-time multiplayer.
 
## What was built (Milestone Three, built by 8/2/2026)
 
- The hash table from my CS 300 advising program, rebuilt in JavaScript and holding players instead of courses. It is filled from the database when the server starts, and one entry is updated at a time after that rather than reloading everybody.
- A player search on the dashboard. Typing a full username finds that account straight away, and typing part of one returns everybody whose name contains it, with exact matches sorted to the front and the list capped at ten results.
- Dynamic resizing. The table starts at sixteen slots and doubles once it passes a load factor of 0.75, rehashing every player into the new table, instead of staying stuck at the size I originally picked for eight courses.
- A stronger hash function. The C++ version added up the character codes, which meant two names with the same letters in a different order always collided, so the new one multiplies by thirty one first to make the position of each letter count.
- A player directory listing every account in alphanumeric order, and a profile page for each account, both served out of that same table.
 
## What was built (Milestone Four, built by 8/9/2026)
 
- A relational schema with three tables instead of one flat one, `users` for credentials, `profiles` for the display side, and `follows` for players following other players, with foreign keys tying them together.
- Salted password hashing carried over from my CS 465 project. Each account gets its own random salt, so two people using the same password still end up with completely different stored values, and there is no password column in the database at all anymore.
- Token based login. Signing in returns a signed token that expires after an hour, and every route that changes data takes your identity from that token instead of from the request body, so a request cannot claim to be somebody else.
- Stricter account rules. Usernames are three to twenty characters of letters, numbers and underscores, names starting with Guest are reserved so nobody can pose as the client's guest mode, and passwords have a minimum length.
- A migration script that moves an older install onto the new schema and hashes every existing password on the way through, so nobody has to make a new account. It renames the old table rather than deleting it, so the original data is still there to compare against.
- Following and followers lists. Both are read out of the same table, the only difference being which side of the link is matched, so one set of rows answers two opposite questions.
 
## How it works
 
1. Log in on the website and pick a color.
2. Click Launch. The page opens a `squaretopia://` link.
3. Windows hands that link to the game, which reads your username, pulls your saved color from the website, and opens your square.
If the game is opened directly instead, it starts in guest mode.
 
You can also search for other players from the dashboard, open their profile, and follow them.
 
## Requirements
 
- Node.js 18+
- MySQL 8+
- Rust 1.97.1+
- Windows 10/11
  
## Setup
 
**1. Database**: build the schema. Everything lives in `schema.sql`, so this is the only command needed:
 
```
cd squaretopia-web
mysql -u root -p < schema.sql
```
 
If you are coming from an older install that still has the single `users` table with plain text passwords, run `node migrate.js` instead. That moves the old data onto the new schema and hashes every existing password on the way through.
 
**2. Website**: in `squaretopia-web`, create a `.env` file with two lines. The first is your MySQL password. The second is the secret used to sign login tokens, which can be any random string as long as it stays private:
 
```
DB_PASSWORD=your_password
JWT_SECRET=your_random_secret
```
 
Then install and run:
 
```
cd squaretopia-web
npm install
node index.js
```
 
The site is at `http://localhost:3000`.
 
**3. Game**: build the client:
 
```
cd squaretopia-client
cargo build --release
```
 
The first build downloads and compiles Bevy and takes several minutes.
 
**4. Launch link** (Windows, one time): in an Administrator Command Prompt, run the commands below so `squaretopia://` links open the game. Adjust the path if yours differs:
 
```
reg add "HKCR\squaretopia" /ve /t REG_SZ /d "URL:Squaretopia Protocol" /f
reg add "HKCR\squaretopia" /v "URL Protocol" /t REG_SZ /d "" /f
reg add "HKCR\squaretopia\shell\open\command" /ve /t REG_SZ /d "\"C:\Users\vaeli\Documents\squaretopia\squaretopia-client\target\release\squaretopia-client.exe\" \"%1\"" /f
```
 
## Running it
 
1. Start the website: `node index.js` in `squaretopia-web`.
2. Go to `http://localhost:3000`, log in, pick a color, and click Save.
3. Click Launch and approve the browser prompt.
4. The game opens as you. Move with WASD.
To see guest mode, run `cargo run` in `squaretopia-client` instead, or use the Play as Guest button on the login page.
 
## Database
 
Three tables, built by `schema.sql`:
 
- **users** holds credentials only, an id, a username, and the `hash` and `salt` for the password. There is no password column. A unique index on username makes duplicates impossible at the database level rather than only being checked in code.
- **profiles** holds the display side, the square color and the bio, one row per user. It is kept apart from `users` so the routes that serve public profiles and the search never touch the table holding the hashes.
- **follows** links one player to another. The pair of ids is the primary key, so the same follow cannot be stored twice, and a check constraint stops anyone following themselves. Reading the rows one way gives who somebody follows, and matching the other column gives who follows them.
 
Both `profiles` and `follows` point at `users` with `ON DELETE CASCADE`, so removing an account clears its profile and every follow it was part of automatically. That was the specific weakness I identified with the document database in my CS 465 project, where nothing stopped a record from pointing at somebody who no longer existed.
 
Passwords never reach the database in a readable form. Registering runs the password through PBKDF2 with a random per account salt, which is the same approach as my CS 465 project, and logging in repeats that calculation on whatever was typed and compares the results. Because each account has its own salt, two people using the same password still end up with completely different stored values.
 
## Project layout
 
```
squaretopia/
  squaretopia-client/         Rust + Bevy game client
    src/main.rs               The whole client
    target/                   Build output, created by cargo
    Cargo.toml                Rust dependencies
    Cargo.lock                Locked dependency versions
    README.md                 Notes for the client
  squaretopia-web/            Node + Express backend and website
    middleware/auth.js        Checks the token on routes that change data
    models/user.js            Password hashing and login tokens (from CS 465)
    node_modules/             Installed packages, created by npm install
    public/index.html         Login page and dashboard
    public/profile.html       A single player's profile
    public/style.css          Styling for both pages
    routes/auth.js            Register and login
    routes/players.js         Profiles, search, directory and follows
    search/hashtable.js       The hash table from CS 300, powers player search
    .env                      Database password and token secret
    config.js                 Settings in one place, hashing and search limits
    db.js                     The MySQL connection pool
    index.js                  Starts the server and mounts the routes
    migrate.js                Moves an older install onto the new schema
    package.json              Node dependencies
    package-lock.json         Locked dependency versions
    rename-follows.js         One time rename of the friends table to follows
    schema.sql                Builds the database from nothing
  README.md                   This file
```
 
## Not done yet (planned for the future)
 
These are deliberately out of scope:
 
- Single player only. No real-time multiplayer (This will not be added in this Capstone)
- No delete account feature. Accounts can only be removed directly in MySQL, and the search index will keep a stale copy of them until the server restarts.

## How I run it personally (after initial setup is complete)
 
**1. Make sure MySQL is running.** Use a terminal with admin privileges and run:
 
```
net start MySQL84
```
 
If it's already running or starts running, then that part is done.
 
**2. Start the website.** Open a new regular terminal and run:
 
```
cd /d "C:\Users\vaeli\Documents\squaretopia\squaretopia-web"
node index.js
```
 
Wait for the `SQUARETOPIA WEB READY: http://localhost:3000` message. Make sure to leave this window open.
 
**3. Open the site.** Go to your browser and type `http://localhost:3000` to access it. Then you can log in, pick a color, and save (optional).
 
**4. Run the game.** You can either run it directly in the terminal to access guest mode:
 
```
cd /d "C:\Users\vaeli\Documents\squaretopia\squaretopia-client"
cargo run
```
 
Or you can simply go to the browser and launch the client after you are logged in. This time it will grab your actual user.
 
To summarize, you need:
 
- An admin window to verify that MySQL is running.
- A web window with `node index.js`, kept open the whole time so the server is running.
- A client window: either use `cargo run` for guest testing, or just use the browser's Launch button for the real user.
