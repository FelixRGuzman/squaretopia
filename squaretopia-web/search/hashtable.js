//============================================================================
// Name        : hashtable.js
// Author      : Felix Guzman
// Version     : 8.0 (version 7 was the C++ one, ProjectTwo.cpp)
// Description : CS 499 Enhancement Two, my CS 300 hash table rebuilt for Squaretopia
//============================================================================


/*
* This is the same hash table I wrote for the CS 300 advising program, moved out of C++ and into
* JavaScript so it can live inside the Squaretopia website backend. It used to hold courses and read out
* of a CSV sitting next to the exe, now it holds players and reads out of the MySQL users table.
* The speed comes from the hash function working out which slot a name belongs in, so we go straight
* there instead of checking every player until we find a match. Two names can be sent to the same
* slot though, and when that happens we link them together with the next pointer rather than
* overwriting anyone, which is the chaining part.
* What I fixed from the CS 300 version: the table was stuck at 16 slots forever because I picked 16
* for 8 courses and never thought past it. Now, it grows on its own now depending on registered players. 
* Searching was also exact match only, which is fine for a course number you already know but not a username you are half sure of,
* so partial search got added on top. Anything else that I may have missed has been annotated below!!
*/

// Initially, we had 8 courses and just doubled it, players are not a fixed list like a course catalog so this is
// only the starting size now and the table grows past it on its own

const INITIAL_TABLE_SIZE = 16;

// Players are divided by slots, which works out to the average chain length. Once we pass this the chains
// are long enough that we are back to checking things one by one, so this is where we grow.

const MAX_LOAD_FACTOR = 0.75;

// Most results a partial search hands back, this keeps a really broad search from getting slower as more people register.

const MAX_RESULTS = 10;

let hashTable = new Array(INITIAL_TABLE_SIZE).fill(null);

let tableSize = INITIAL_TABLE_SIZE; // this was a const in C++, which is why the old table could never grow
let playerCount = 0; // needed for the load factor, the C++ version never counted anything

let isDataLoaded = false; // let's approach this with flagging like before...

// Here is our hash function to compute index
// The % keeps the answer inside the table so a big number still lands on a real slot

function hashFunction(username, size) {
    let hashValue = 0;
    for (const ch of username) {
        // The C++ one just added the ascii codes. adding ignores order,
        // Also multiplying by 31 first makes the position of each letter count.
        hashValue = (hashValue * 31 + ch.charCodeAt(0)) % size;
    }
    return hashValue;
}

// Here we create our player object with the desired parameters

function createPlayer(username, color, bio) {
    const player = {
        username: username,
        color: color,
        bio: bio,
        next: null // here is our next pointer set to null, will play a part later
    };
    return player;
}

// here is our insertPlayer function to handle collisions/chaining

function insertPlayer(player) {
    const key = hashFunction(player.username.toUpperCase(), tableSize);

    if (!hashTable[key]) {
        hashTable[key] = player;
    }
    else {
        // slot taken, so link onto the end of that chain instead of overwriting whoever is there
        let current = hashTable[key];
        while (current.next) {
            current = current.next;
        }
        current.next = player;
    }

    playerCount++;

    // this check is the fix for the flaw I found, the old table stayed at 16 slots no matter how much data went in

    if (playerCount / tableSize > MAX_LOAD_FACTOR) {
        resizeTable();
    }
}

// Here is our resizeTable function, this is new and did not exist in the C++ version

function resizeTable() {
    const oldTable = hashTable;
    const oldSize = tableSize;

    tableSize = oldSize * 2;
    hashTable = new Array(tableSize).fill(null);
    playerCount = 0; // insertPlayer counts everyone again as it puts them back

    // everyone has to be hashed again because the slot is worked out using the table size, so doubling
    // the size means almost everybody belongs somewhere new. we cannot just move the chains over.

    for (let i = 0; i < oldSize; ++i) {
        let current = oldTable[i];

        while (current) {
            const nextPlayer = current.next; // save this first, inserting overwrites it
            current.next = null; // unlink so no dragging old chain along

            insertPlayer(current);

            current = nextPlayer;
        }
    }

    console.log(`[HashTable] Table grew from ${oldSize} to ${tableSize} slots.`);
}

// Now we load the players in the loadPlayers function.
// The CS 300 version opened the csv itself, here the rows are handed to us straight from MySQL, same idea just a better 
// because the data is shared and always current

function loadPlayers(rows) {
    hashTable = new Array(INITIAL_TABLE_SIZE).fill(null);
    tableSize = INITIAL_TABLE_SIZE;
    playerCount = 0;

    for (const row of rows) {
        if (!row.username) {
            console.log("Error! Wrong data format!");
            continue; // this actually simplifies the process and organizes the coding structure further
        }

        const player = createPlayer(row.username, row.color, row.bio);

        insertPlayer(player); // will use for collisions
    }

    isDataLoaded = true;
    console.log(`[HashTable] ${playerCount} player(s) loaded into ${tableSize} slots.`);
}

// Our search function, works just like desired, will return the player if they exist
// this is the fast one, we work out the slot and only check that one short chain.

function searchPlayer(username) {
    if (!isDataLoaded) { // added an extra check, the C++ search was missing this and just said not found
        console.log("The player index has not been loaded yet.");
        return null;
    }

    const searchKey = username.toUpperCase(); // so COOLIO still finds coolio, same trick as the course numbers
    const key = hashFunction(searchKey, tableSize);

    let current = hashTable[key];

    while (current) {
        if (current.username.toUpperCase() === searchKey) {
            return current;
        }
        current = current.next;
    }

    return null; // player was not found
}

// Here is our searchPartial function, it's also new.
// This one checks every slot, which is the slow thing a hash table normally saves us from. 
// The function scatters names on purpose, so "coo" is sent nowhere near "coolio" and there is no slot to jump to
// The result cap is how we keep that slower path under control.

function searchPartial(term) {
    if (!isDataLoaded) {
        console.log("The player index has not been loaded yet.");
        return [];
    }

    const searchKey = term.toUpperCase();
    const matches = [];

    for (let i = 0; i < tableSize; ++i) {
        let current = hashTable[i];

        while (current) {
            const name = current.username.toUpperCase();

            if (name.includes(searchKey)) {
                // A full username typed in should show that person before someone who just has those
                // letters buried in their name
                const isExact = (name === searchKey);
                matches.push({ player: current, isExact: isExact });
            }

            current = current.next;
        }
    }

    matches.sort((a, b) => {
        if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
        return a.player.username.localeCompare(b.player.username);
    });

    // cut the list off so one very broad search cannot hand back every account on the platform
    return matches.slice(0, MAX_RESULTS).map(m => m.player);
}

// displaying all players in the desired alphanumeric order
// the table has no order of its own since names get scattered, so we collect everyone and then sort

function printPlayerList() {
    if (!isDataLoaded) { // added an extra check that makes the program more logical and easier for the user
        console.log("You haven't loaded the players, load them and try again.");
        return [];
    }

    const keys = [];

    for (let i = 0; i < tableSize; ++i) {
        let current = hashTable[i];
        while (current) {
            keys.push(current.username);
            current = current.next;
        }
    }

    keys.sort((a, b) => a.localeCompare(b));

    const list = [];
    for (const key of keys) {
        const player = searchPlayer(key);
        if (player) {
            list.push(player);
        }
    }
    return list;
}

// Keeps one player in sync without rebuilding the whole table, someone saving a color should not mean
// reloading every account out of the database again

function upsertPlayer(username, color, bio) {
    const existing = searchPlayer(username);

    if (existing) {
        existing.color = color;
        existing.bio = bio;
        return;
    }

    insertPlayer(createPlayer(username, color, bio));
}

module.exports = { // loads...
    loadPlayers,
    searchPlayer,
    searchPartial,
    printPlayerList,
    upsertPlayer
};