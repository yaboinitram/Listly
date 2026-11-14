const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const pool = require('../../src/db');

const uniqueEmail = (tag) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

async function makeUser(tag) {
    const userId = randomUUID();
    const email = uniqueEmail(tag);
    await pool.query(
        'INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)',
        [userId, email, 'hashed_password']
    );
    const token = jwt.sign({sub: userId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return { userId, email, auth: `Bearer ${token}` };
}

module.exports = { makeUser };