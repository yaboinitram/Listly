const itemRepo = require('../repositories/itemRepository');
const httpError = require('../httpError');

const MAX_TITLE_LENGTH = 255;  // items.title is VARCHAR(255)
const MAX_URL_LENGTH = 2048;   // items.source_url and items.image_url are VARCHAR(2048)
const MAX_PRICE = 99999999.99; //items.price is DECIMAL(10,2)

// Only http and https links, so a javascript: link can never be saved and shown as a link.
function isWebUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// T-46: checks the request body and converts it to the shape itemRepository.insert expects.
function validateItem(body) {
  const { title, price, image_url: imageUrl, source_url: sourceUrl } = body ?? {};

  if (typeof title !== 'string' || title.trim() === '') {
    throw httpError(400, 'Item title is required.');
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw httpError(400, `Item title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  }
  if (!isWebUrl(sourceUrl)) {
    throw httpError(400, 'source_url must be an http or https link.');
  }
  if (price != null && !(Number.isFinite(price) && price >= 0 && price <= MAX_PRICE)) {
    throw httpError(400, 'price must be a number from 0 to 99999999.99.');
  }
  if (imageUrl != null && !isWebUrl(imageUrl)) {
    throw httpError(400, 'image_url must be an http or https link.');
  }

  return { title: title.trim(), price: price ?? null, imageUrl: imageUrl ?? null, sourceUrl };
}

// T-42: a wishlist the user doesn't own gets 404, not 403, so its ID is never confirmed.
async function addItem(ownerId, wishlistId, body) {
  const item = validateItem(body);
  const saved = await itemRepo.insert(ownerId, wishlistId, item);
  if (!saved) throw httpError(404, 'Wishlist not found.');
  return saved;
}

async function listItems(ownerId, wishlistId) {
  const items = await itemRepo.listForOwnedWishlist(ownerId, wishlistId);
  if (!items) throw httpError(404, 'Wishlist not found.');
  return items;
}

// T-73: same checks as adding an item. PUT replaces the item, so a field left out is cleared.
async function updateItem(ownerId, wishlistId, itemId, body) {
  const item = validateItem(body);
  const updated = await itemRepo.update(ownerId, wishlistId, itemId, item);
  if (!updated) throw httpError(404, 'Item not found.');
  return updated;
}

// T-74
async function removeItem(ownerId, wishlistId, itemId) {
  const removed = await itemRepo.remove(ownerId, wishlistId, itemId);
  if (!removed) throw httpError(404, 'Item not found.');
}

module.exports = { addItem, listItems, updateItem, removeItem };