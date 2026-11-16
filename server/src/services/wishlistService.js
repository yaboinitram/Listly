const wishlistRepo = require('../repositories/wishlistRepository');
const httpError = require('../httpError');

const MAX_NAME_LENGTH = 100; // wishlists.name is VARCHAR(100) in the database

// T-36: name is required and at most 100 characters. Returns the trimmed name.
function validateName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw httpError(400, 'Wishlist name is required.');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw httpError(400, `Wishlist name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  return trimmed;
}

async function createWishlist(ownerId, name) {
  return wishlistRepo.create(ownerId, validateName(name));
}

// T-37: only the signed-in user's wishlists (the repository scopes by owner),
// with share_id and item_count for the popup's list screen.
async function listWishlists(ownerId) {
  return wishlistRepo.listSummariesByOwner(ownerId);
}

// Same name rules as creating. A wishlist the user doesn't own gets 404, like items (T-42).
async function renameWishlist(ownerId, wishlistId, name) {
  const renamed = await wishlistRepo.rename(ownerId, wishlistId, validateName(name));
  if (!renamed) throw httpError(404, 'Wishlist not found.');
  return renamed;
}

async function deleteWishlist(ownerId, wishlistId) {
  const removed = await wishlistRepo.remove(ownerId, wishlistId);
  if (!removed) throw httpError(404, 'Wishlist not found.');
}

// T-114: the list the popup's home screen uses, with each list's item_count and share_id.
async function listWishlistSummaries(ownerId) {
  return wishlistRepo.listSummariesByOwner(ownerId);
}

// T-136: same name rules as creating a wishlist (T-36).
async function renameWishlist(ownerId, wishlistId, name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw httpError(400, 'Wishlist name is required.');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw httpError(400, `Wishlist name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  const renamed = await wishlistRepo.rename(ownerId, wishlistId, trimmed);
  if (!renamed) throw httpError(404, 'Wishlist not found.');
  return renamed;
}

// T-137
async function deleteWishlist(ownerId, wishlistId) {
  const removed = await wishlistRepo.remove(ownerId, wishlistId);
  if (!removed) throw httpError(404, 'Wishlist not found.');
}

module.exports = { createWishlist, listWishlists, listWishlistSummaries, renameWishlist, deleteWishlist };
