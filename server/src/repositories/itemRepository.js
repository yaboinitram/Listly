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

module.exports = { insert, listForOwnedWishlist };