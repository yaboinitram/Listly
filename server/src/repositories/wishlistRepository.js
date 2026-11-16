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

// What the popup's list screen shows: each of the owner's wishlists with its share ID
// (null until shared) and how many items it holds. Same owner scoping as listByOwner.
async function listSummariesByOwner(ownerId) {
  const [rows] = await pool.query(
    `SELECT w.wishlist_id, w.name, w.share_id, COUNT(i.item_id) AS item_count
     FROM wishlists w
     LEFT JOIN items i ON i.wishlist_id = w.wishlist_id
     WHERE w.owning_user_id = ?
     GROUP BY w.wishlist_id, w.name, w.share_id
     ORDER BY w.name`,
    [ownerId]
  );
  // COUNT comes back as a BIGINT; make it a plain number for JSON.
  return rows.map((row) => ({ ...row, item_count: Number(row.item_count) }));
}

// Returns the renamed wishlist, or null if ownerId doesn't own it.
async function rename(ownerId, wishlistId, name) {
  const [result] = await pool.query(
    'UPDATE wishlists SET name = ? WHERE wishlist_id = ? AND owning_user_id = ?',
    [name, wishlistId, ownerId]
  );
  if (result.affectedRows === 0) return null;
  return findOwned(ownerId, wishlistId);
}

// Returns true if the wishlist was deleted. Its items go with it (ON DELETE CASCADE),
// and its share link stops working.
async function remove(ownerId, wishlistId) {
  const [result] = await pool.query(
    'DELETE FROM wishlists WHERE wishlist_id = ? AND owning_user_id = ?',
    [wishlistId, ownerId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  create,
  listByOwner,
  listSummariesByOwner,
  findOwned,
  setShareId,
  findByShareId,
  rename,
  remove,
};