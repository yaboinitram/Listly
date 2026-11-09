const wishlistRepo = require('../repositories/wishlistRepository');
const httpError = require('../httpError');

const MAX_NAME_LENGTH = 100; // wishlists.name is VARCHAR(100) in the database

// T-36: name is required and at most 100 characters.
async function createWishlist(ownerId, name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw httpError(400, 'Wishlist name is required.');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw httpError(400, `Wishlist name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  return wishlistRepo.create(ownerId, trimmed);
}

// T-37: only the signed-in user's wishlists (the repository scopes by owner).
async function listWishlists(ownerId) {
  return wishlistRepo.listByOwner(ownerId);
}

module.exports = { createWishlist, listWishlists };