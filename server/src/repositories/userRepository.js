const pool = require('../db');
const { randomUUID } = require('crypto');

async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT user_id, email, password_hash FROM users WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

async function create(email, passwordHash) {
  const userId = randomUUID();
  await pool.query(
    'INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)',
    [userId, email, passwordHash]
  );
  return { user_id: userId, email };
}

// T-80: the wishlist and its share_id (null until shared), or null if ownerId doesn't own it.
async function findOwned(ownerId, wishlistId) {
  const [rows] = await pool.query(
    'SELECT wishlist_id, name, share_id FROM wishlists WHERE wishlist_id = ? AND owning_user_id = ?',
    [wishlistId, ownerId]
  );
  return rows[0] || null;
}

// T-80: saves the share ID only if the wishlist doesn't have one yet. Returns true if it was saved.
// If another wishlist already uses this ID, the unique index makes MySQL throw ER_DUP_ENTRY.
async function setShareId(ownerId, wishlistId, shareId) {
  const [result] = await pool.query(
    `UPDATE wishlists SET share_id = ?
     WHERE wishlist_id = ? AND owning_user_id = ? AND share_id IS NULL`,
    [shareId, wishlistId, ownerId]
  );
  return result.affectedRows === 1;
}

// T-85: public lookup with no owner check. Knowing the share ID is the permission.
async function findByShareId(shareId) {
  const [rows] = await pool.query(
    'SELECT wishlist_id, name FROM wishlists WHERE share_id = ?',
    [shareId]
  );
  return rows[0] || null;
}

module.exports = { findByEmail, create, findOwned, setShareId, findByShareId};
