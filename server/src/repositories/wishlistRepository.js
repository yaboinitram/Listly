const pool = require('../db');
const { randomUUID } = require('crypto');

async function create(ownerId, name) {
  const wishlistId = randomUUID();
  await pool.query(
    'INSERT INTO wishlists (wishlist_id, owning_user_id, name) VALUES (?, ?, ?)',
    [wishlistId, ownerId, name]
  );
  return { wishlist_id: wishlistId, name };
}

// Owner scoping (T-41): a wishlist is only ever returned together with its owner's ID.
async function listByOwner(ownerId) {
  const [rows] = await pool.query(
    'SELECT wishlist_id, name FROM wishlists WHERE owning_user_id = ? ORDER BY name',
    [ownerId]
  );
  return rows;
}

module.exports = { create, listByOwner };