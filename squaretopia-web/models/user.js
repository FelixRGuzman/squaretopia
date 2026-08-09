// This user model is heavily based on the CS 465 Travlr project.

// In CS 465 these were methods utilizing a Mongoose schema, MongoDB
// documents are just objects that can carry their own behavior. 


// MySQL rows however, are just rows, there is no schema object to attach anything to, so the same three
// operations become plain functions that take a row and work on it. 

// The crypto is the same, although the container has changed.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST,
    SALT_BYTES,
    TOKEN_EXPIRY
} = require('../config');

// Turns a plain password into something safe to store.
// The salt is basically a random string generated per account, so two people with the same
// password still end up with completely different stored values. Without it an
// attacker could hash a common password once and spot everybody using it.
// Nothing here can be reversed, the password itself is never kept anywhere.

function setPassword(password) {
    const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
        .toString('hex');
    return { hash, salt };
}

// Checks a login attempt.
// We cannot un-hash the stored value, so instead we run the typed password
// through the exact same steps using that account's saved salt and see if we
// land on the same result.

function validPassword(password, storedHash, storedSalt) {
    if (!password || !storedHash || !storedSalt) {
        return false;
    }

    const hash = crypto.pbkdf2Sync(password, storedSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
        .toString('hex');

    // timingSafeEqual compares the whole thing instead of stopping at the first
    // wrong character, so an attacker cannot learn anything from how long the check took. 

    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

// Builds the login token, same as generateJWT in CS 465.
// The token says who you are and is signed with a secret only the server knows,
// so the browser cannot edit it without the signature failing. It expires on its
// own, which is a good practice, a stolen token will not be good forever.

function generateJWT(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username
        },
        process.env.JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
}

module.exports = {
    setPassword,
    validPassword,
    generateJWT
};
