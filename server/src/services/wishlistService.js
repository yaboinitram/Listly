const wishlistRepo = require('../repositories/wishlistRepository');
const itemRepo = require('../repositories/itemRepository');

const MAX_NAME_LENGTH = 100;    // wishlists.name is VARCHAR(100)
const MAX_TITLE_LENGTH = 255;   // items.title is VARCHAR(255)
const MAX_URL_LENGTH = 2048;    // items.source_url and image_url are VARCHAR(2048)
const MAX_PRICE = 99999999.99;  // items.price is DECIMAL(10,2)

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// T-42: a wishlist that doesn't exist and one that belongs to someone else both
// get the same 404, so nobody can find out which wishlist IDs exist.
async function getOwnedWishlist(userId, wishlistId) {
  const wishlist = await wishlistRepo.findByIdForOwner(wishlistId, userId);
  if (!wishlist) throw httpError(404, 'Wishlist not found.');
  return wishlist;
}

// T-36
async function createWishlist(userId, rawName) {
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (name === '' || name.length > MAX_NAME_LENGTH) {
    throw httpError(400, 'Name is required and must be 100 characters or fewer.');
  }
  return wishlistRepo.create(userId, name);
}

// T-37
async function listWishlists(userId) {
  return wishlistRepo.listByOwner(userId);
}

// T-46: check an item before it is saved
function validateItem(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title === '' || title.length > MAX_TITLE_LENGTH) {
    throw httpError(400, 'Title is required and must be 255 characters or fewer.');
  }
  if (!isHttpUrl(body.source_url)) {
    throw httpError(400, 'source_url must be an http or https link.');
  }
  if (!isBlank(body.image_url) && !isHttpUrl(body.image_url)) {
    throw httpError(400, 'image_url must be an http or https link.');
  }

  let price = null;
  if (!isBlank(body.price)) {
    price = typeof body.price === 'number' || typeof body.price === 'string' ? Number(body.price) : NaN;
    if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
      throw httpError(400, 'Price must be a number from 0 to 99999999.99.');
    }
  }

  return {
    title,
    price,
    image_url: isBlank(body.image_url) ? null : body.image_url,
    source_url: body.source_url,
  };
}

// T-46 (with the T-42 ownership check first)
async function addItem(userId, wishlistId, body) {
  await getOwnedWishlist(userId, wishlistId);
  return itemRepo.insert(wishlistId, validateItem(body));
}

async function listItems(userId, wishlistId) {
  await getOwnedWishlist(userId, wishlistId);
  return itemRepo.listByWishlist(wishlistId);
}

module.exports = { createWishlist, listWishlists, addItem, listItems };