const pool = require('../db');
const { randomUUID } = require('crypto');

async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT user_id, email, password_hash FROM users WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

async function createUser (email, passwordHash) {
  const userId = randomUUID();
  await pool.query(
    'INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)',
    [userId, email, passwordHash]
  );
  return { user_id: userId, email };
}

module.exports = { findByEmail, createUser, create: createUser };