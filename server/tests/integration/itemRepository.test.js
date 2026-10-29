const pool = require('../../src/db');
const userRepo = require('../../src/repositories/userRepository');
const wishlistRepo = require('../../src/repositories/wishlistRepository');
const itemRepo = require('../../src/repositories/itemRepository');

afterAll(async () => { await pool.end(); });

const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

const ITEM = {
  title: 'Blue Kettle',
  price: 29.99,
  imageUrl: 'https://shop.test/kettle.jpg',
  sourceUrl: 'https://shop.test/kettle',
};

// Two users, each with one wishlist.
async function setup() {
  const a = await userRepo.create(uniqueEmail('ia'), 'fake-hash');
  const b = await userRepo.create(uniqueEmail('ib'), 'fake-hash');
  const aList = await wishlistRepo.create(a.user_id, 'A list');
  const bList = await wishlistRepo.create(b.user_id, 'B list');
  return { a, b, aList, bList };
}

test('insert then listForOwnedWishlist returns the saved item', async () => {
  const { a, aList } = await setup();
  const saved = await itemRepo.insert(a.user_id, aList.wishlist_id, ITEM);
  expect(saved.item_id).toBeDefined();

  const items = await itemRepo.listForOwnedWishlist(a.user_id, aList.wishlist_id);
  expect(items).toHaveLength(1);
  expect(items[0].title).toBe('Blue Kettle');
  expect(Number(items[0].price)).toBe(29.99); // mysql2 returns DECIMAL as a string
  expect(items[0].source_url).toBe(ITEM.sourceUrl);
});

test('price and image are optional', async () => {
  const { a, aList } = await setup();
  const saved = await itemRepo.insert(a.user_id, aList.wishlist_id, {
    title: 'Mystery gift',
    sourceUrl: 'https://shop.test/mystery',
  });
  expect(saved).not.toBeNull();

  const [item] = await itemRepo.listForOwnedWishlist(a.user_id, aList.wishlist_id);
  expect(item.price).toBeNull();
  expect(item.image_url).toBeNull();
});

test('an owned wishlist with no items lists as an empty array, not null', async () => {
  const { a, aList } = await setup();
  expect(await itemRepo.listForOwnedWishlist(a.user_id, aList.wishlist_id)).toEqual([]);
});

test("insert into another user's wishlist returns null and saves nothing", async () => {
  const { a, b, aList } = await setup();
  expect(await itemRepo.insert(b.user_id, aList.wishlist_id, ITEM)).toBeNull();

  const items = await itemRepo.listForOwnedWishlist(a.user_id, aList.wishlist_id);
  expect(items).toEqual([]);
});

test("listing another user's wishlist returns null", async () => {
  const { a, b, aList } = await setup();
  await itemRepo.insert(a.user_id, aList.wishlist_id, ITEM);
  expect(await itemRepo.listForOwnedWishlist(b.user_id, aList.wishlist_id)).toBeNull();
});

test('an unknown wishlist ID returns null for both functions', async () => {
  const { a } = await setup();
  const missing = '00000000-0000-0000-0000-000000000000';
  expect(await itemRepo.insert(a.user_id, missing, ITEM)).toBeNull();
  expect(await itemRepo.listForOwnedWishlist(a.user_id, missing)).toBeNull();
});