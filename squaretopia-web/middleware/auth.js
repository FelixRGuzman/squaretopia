// Token checking, carried over from the authenticateJWT function in my CS 465 routes file and tidied up a bit.
// Any route that changes data goes through this first. 
// It reads the token out of the request header, checks the signature, and puts the decoded account on req.auth.
// That way the route knows who is actually asking. 
// Routes that only read data are left open, same as CS 465 where anyone could browse trips but only an admin could modify.

const jwt = require('jsonwebtoken');

function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: "Login required." });
    }

    // Getting the second half.
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: "Malformed authorization header." });
    }

    const token = parts[1];

    // Verify does two things, it checks the signature so an edited token is rejected
    // as well as checking the expiry so an old one stops working.

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log(`[Auth] Rejected token: ${err.message}`);
            return res.status(401).json({ error: "Invalid or expired session." });
        }

        // Essentially, the route now takes the username from here instead of from the request body.
        // So a request cannot claim to be somebody else just by typing their name into it.
        
        req.auth = decoded;
        next();
    });
}

module.exports = authenticateJWT;
