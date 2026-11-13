const pool = require('../db');
const { randomUUID } = require('crypto');

// Returns the new item, or null if the wishlist doesn't exist or isn't owned by ownerId.
// The ownership check and the INSERT are one statement, so they can't get out of sync.
async function insert(ownerId, wishlistId, { title, price = null, imageUrl = null, sourceUrl }) {
  const itemId = randomUUID();
  const [result] = await pool.query(
    `INSERT INTO items (item_id, wishlist_id, title, price, image_url, source_url)
     SELECT ?, w.wishlist_id, ?, ?, ?, ?
     FROM wishlists w
     WHERE w.wishlist_id = ? AND w.owning_user_id = ?`,
    [itemId, title, price, imageUrl, sourceUrl, wishlistId, ownerId]
  );
  if (result.affectedRows === 0) return null;
  return { item_id: itemId, wishlist_id: wishlistId, title, price, image_url: imageUrl, source_url: sourceUrl };
}

// Returns the items (possibly an empty array), or null if the wishlist isn't owned by ownerId.
async function listForOwnedWishlist(ownerId, wishlistId) {
  const [owned] = await pool.query(
    'SELECT 1 FROM wishlists WHERE wishlist_id = ? AND owning_user_id = ?',
    [wishlistId, ownerId]
  );
  if (owned.length === 0) return null;

  const [rows] = await pool.query(
    `SELECT item_id, title, price, image_url, source_url, date_added
     FROM items WHERE wishlist_id = ? ORDER BY date_added, item_id`,
    [wishlistId]
  );
  return rows;
}

// T-73: returns the updated item, or null if the item isn't in that wishlist or the user doesn't own it.
async function update(ownerId, wishlistId, itemId, { title, price = null, imageUrl = null, sourceUrl }) {
  const [result] = await pool.query(
    `UPDATE items i
     JOIN wishlists w ON w.wishlist_id = i.wishlist_id
     SET i.title = ?, i.price = ?, i.image_url = ?, i.source_url = ?
     WHERE i.item_id = ? AND i.wishlist_id = ? AND w.owning_user_id = ?`,
    [title, price, imageUrl, sourceUrl, itemId, wishlistId, ownerId]
  );
  if (result.affectedRows === 0) return null;
  return { item_id: itemId, wishlist_id: wishlistId, title, price, image_url: imageUrl, source_url: sourceUrl };
}

// T-74: returns true if the item was deleted, false if it isn't in that wishlist or the user doesn't own it.
async function remove(ownerId, wishlistId, itemId) {
  const [result] = await pool.query(
    `DELETE i FROM items i
     JOIN wishlists w ON w.wishlist_id = i.wishlist_id
     WHERE i.item_id = ? AND i.wishlist_id = ? AND w.owning_user_id = ?`,
    [itemId, wishlistId, ownerId]
  );
  return result.affectedRows > 0;
}

// T-85, T-90: items for the public share page. Display fields only, no IDs.
async function listForShare(wishlistId) {
  const [rows] = await pool.query(
    `SELECT title, price, image_url, source_url
     FROM items WHERE wishlist_id = ? ORDER BY date_added, item_id`,
    [wishlistId]
  );
  return rows;
}

module.exports = { insert, listForOwnedWishlist, update, remove, listForShare };