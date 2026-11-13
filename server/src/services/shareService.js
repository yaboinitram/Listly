const wishlistRepo = require('../repositories/wishlistRepository');
const itemRepo = require('../repositories/itemRepository');
const httpError = require('../httpError');
const { generateShareId } = require('../shareId');

const MAX_ATTEMPTS = 5;

/* T-80: owner only. Sharing a wishlist again returns the link it already has.
`generate` is a parameter so a test can force a collision.*/
async function createShareLink(ownerId, wishlistId, generate = generateShareId) {
  const wishlist = await wishlistRepo.findOwned(ownerId, wishlistId);
  if (!wishlist) throw httpError(404, 'Wishlist not found.');
  if (wishlist.share_id) return { share_id: wishlist.share_id, created: false };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const shareId = generate();
    try {
      const saved = await wishlistRepo.setShareId(ownerId, wishlistId, shareId);
      if (saved) return { share_id: shareId, created: true };
      
      // Not saved: another request shared this wishlist a moment ago. Return that link.
      const current = await wishlistRepo.findOwned(ownerId, wishlistId);
      if (!current) throw httpError(404, 'Wishlist not found.');
      return { share_id: current.share_id, created: false };
    } catch (err) {
      // A collision means another wishlist already has this ID, so try a new one.
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
  throw httpError(500, 'Could not create a unique share link.');
}

// T-85, T-90: public. Only the wishlist name and item display fields, never IDs or owner details.
async function getSharedWishlist(shareId) {
  const wishlist = await wishlistRepo.findByShareId(shareId);
  if (!wishlist) throw httpError(404, 'Wishlist not found.');

  const items = await itemRepo.listForShare(wishlist.wishlist_id);
  return { name: wishlist.name, items };
}

module.exports = { createShareLink, getSharedWishlist };