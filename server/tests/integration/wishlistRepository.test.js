const pool = require('../../src/db');
const userRepo = require('../../src/repositories/userRepository');
const wishlistRepo = require('../../src/repositories/wishlistRepository');

afterAll(async () => { await pool.end(); });

const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

test('create then listByOwner returns the wishlist', async () => {
  const user = await userRepo.create(uniqueEmail('wl'), 'fake-hash');
  const created = await wishlistRepo.create(user.user_id, 'Birthday');

  const lists = await wishlistRepo.listByOwner(user.user_id);
  expect(lists).toEqual([{ wishlist_id: created.wishlist_id, name: 'Birthday' }]);
});

test('listByOwner returns an empty array for a user with no wishlists', async () => {
  const user = await userRepo.create(uniqueEmail('empty'), 'fake-hash');
  expect(await wishlistRepo.listByOwner(user.user_id)).toEqual([]);
});

test("listByOwner never returns another user's wishlists", async () => {
  const a = await userRepo.create(uniqueEmail('a'), 'fake-hash');
  const b = await userRepo.create(uniqueEmail('b'), 'fake-hash');
  await wishlistRepo.create(a.user_id, 'A only');
  await wishlistRepo.create(b.user_id, 'B only');

  const aLists = await wishlistRepo.listByOwner(a.user_id);
  const bLists = await wishlistRepo.listByOwner(b.user_id);
  expect(aLists.map((w) => w.name)).toEqual(['A only']);
  expect(bLists.map((w) => w.name)).toEqual(['B only']);
});