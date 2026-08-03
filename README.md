# Squaretopia
 
## About this project
 
Squaretopia is the CS 499 capstone enhancement of an earlier prototype called Pixgate. The original Pixgate client was written in the Godot engine using GDScript. This project will contain three enhancements across the areas of software design and engineering, data structures and algorithms, and finally databases.
 
We tackle the Software Design and Engineering enhancement in Milestone Two. In this milestone the client is rewritten in Rust with the Bevy engine, the website-to-client data handoff is rebuilt, and the original's hardcoded paths and missing documentation are addressed to some extent.
 
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
 
## How it works
 
1. Log in on the website and pick a color.
2. Click Launch. The page opens a `squaretopia://` link.
3. Windows hands that link to the game, which reads your username, pulls your saved color from the website, and opens your square.
If the game is opened directly instead, it starts in guest mode.
 
## Requirements
 
- Node.js 18+
- MySQL 8+
- Rust 1.97.1+
- Windows 10/11
  
## Setup
 
**1. Database**: create the database and table:
 
```
mysql -u root -p -e "CREATE DATABASE squaretopia_db; USE squaretopia_db; CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, color VARCHAR(32) DEFAULT '#3498db');"
```
 
**2. Website**: in `squaretopia-web`, create a `.env` file with your MySQL password:
 
```
DB_PASSWORD=your_password
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
To see guest mode, run `cargo run` in `squaretopia-client` instead.
 
## Project layout
 
```
squaretopia/
  squaretopia-web/          Node + Express backend and login page
    index.js                Server and API routes
    public/index.html       Login page and dashboard
  squaretopia-client/       Rust + Bevy game client
    src/main.rs             The whole client
    Cargo.toml              Rust dependencies
```
 
## Not done yet (planned for later milestones)
 
These are deliberately out of scope for this enhancement and are planned for the Databases and Algorithms enhancements later in the capstone:
 
- Passwords are stored as plain text. Salting and hashing come later, carried over from the CS 465 project.
- The launch link trusts the username it is given; there is no real session token yet, Guest mode just solves one part of the problem.
- No profile search. The player-search feature (the CS 300 enhancement) is not built yet.
- The database is local only, with no migration to a hosted database yet.
- Single player only. No real-time multiplayer (This will not be added in this Capstone)

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
 
