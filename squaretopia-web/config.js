// Settings for the whole backend, kept in one place instead of scattered
// through the routes (a Milestone One finding was hardcoded values everywhere).

module.exports = {
    PORT: 3000,

    // New accounts start blue until the user picks something.
    DEFAULT_COLOR: '#3498db',

    // What a new account's bio says before they write their own.
    DEFAULT_BIO: 'This player has not written a bio yet.',

    // Longest bio we store, anything past this gets cut off.
    MAX_BIO_LENGTH: 200,

    // Longest search term we accept, so a pasted wall of text is rejected early.
    MAX_SEARCH_TERM_LENGTH: 32
};
