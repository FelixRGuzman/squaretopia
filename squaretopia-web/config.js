// Settings for the whole backend, kept in one place instead of scattered
// through the routes (Milestone One had hardcoded values everywhere).

module.exports = {
    PORT: 3000,

    // New accounts start blue until the user picks something.
    DEFAULT_COLOR: '#3498db',

    // What a new account's bio says before they write their own.
    DEFAULT_BIO: 'This player has not written a bio yet.',

    // Longest bio we store, anything past this gets cut off.
    MAX_BIO_LENGTH: 200,

    // Longest search term we accept.
    MAX_SEARCH_TERM_LENGTH: 32,

    // Password hashing settings, carried over from my CS 465 project.
    // The iteration count is what makes guessing passwords slow for an attacker.
    // 1000 is what CS 465 used, so it comes over as is.
    
    PBKDF2_ITERATIONS: 1000,
    PBKDF2_KEYLEN: 64,
    PBKDF2_DIGEST: 'sha512',
    SALT_BYTES: 16,

    // How long a login token stays good for, same one hour as CS 465.
    TOKEN_EXPIRY: '1h',

    // Shortest a password can be. The old site accepted anything at all.
    MIN_PASSWORD_LENGTH: 6
};
