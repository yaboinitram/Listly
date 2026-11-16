// IT-09: deleting a wishlist removes its items and leaves no orphaned rows.
const request = require('supertest');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/db');
const { makeUser } = require('../helpers/makeUser');

afterAll(async () => { await pool.end(); });

// A wishlist with two items, a purchase on one item, a share link, and two share-access log rows.
async function makeFullList(tag) {
  const user = await makeUser(tag);
  const list = (await request(app).post('/wishlists').set('Authorization', user.auth).send({ name: 'Birthday' })).body;
  const itemsPath = `/wishlists/${list.wishlist_id}/items`;
  const itemIds = [];
  for (const title of ['Blue Kettle', 'Mystery gift']) {
    const res = await request(app).post(itemsPath).set('Authorization', user.auth)
      .send({ title, source_url: `https://shop.test/${encodeURIComponent(title)}` });
    itemIds.push(res.body.item_id);
  }
  await pool.query('INSERT INTO purchases (purchase_id, item_id) VALUES (?, ?)', [randomUUID(), itemIds[0]]);
  await request(app).post(`/wishlists/${list.wishlist_id}/share`).set('Authorization', user.auth);
  for (let i = 0; i < 2; i++) {
    await pool.query('INSERT INTO share_access_log (log_id, wishlist_id) VALUES (?, ?)', [randomUUID(), list.wishlist_id]);
  }
  return { ...user, list, itemIds };
}

// How many rows still point at this wishlist, in every table that references it.
async function countRows(wishlistId, itemIds) {
  const count = async (sql, params) => (await pool.query(sql, params))[0][0].n;
  return {
    wishlists: await count('SELECT COUNT(*) AS n FROM wishlists WHERE wishlist_id = ?', [wishlistId]),
    items: await count('SELECT COUNT(*) AS n FROM items WHERE wishlist_id = ?', [wishlistId]),
    purchases: await count('SELECT COUNT(*) AS n FROM purchases WHERE item_id IN (?)', [itemIds]),
    logs: await count('SELECT COUNT(*) AS n FROM share_access_log WHERE wishlist_id = ?', [wishlistId]),
  };
}

test('the setup really creates rows in every table (so the later checks mean something)', async () => {
  const a = await makeFullList('cascade-setup');
  expect(await countRows(a.list.wishlist_id, a.itemIds)).toEqual({ wishlists: 1, items: 2, purchases: 1, logs: 2 });
});

test('deleting a wishlist removes its items, purchases and share-log rows (IT-09)', async () => {
  const a = await makeFullList('cascade');

  const res = await request(app).delete(`/wishlists/${a.list.wishlist_id}`).set('Authorization', a.auth);
  expect(res.status).toBe(204);

  expect(await countRows(a.list.wishlist_id, a.itemIds)).toEqual({ wishlists: 0, items: 0, purchases: 0, logs: 0 });
});

test("deleting one wishlist leaves the same owner's other wishlist and its items alone (IT-09)", async () => {
  const a = await makeFullList('cascade-sibling');
  const other = (await request(app).post('/wishlists').set('Authorization', a.auth).send({ name: 'Holiday' })).body;
  await request(app).post(`/wishlists/${other.wishlist_id}/items`).set('Authorization', a.auth)
    .send({ title: 'Scarf', source_url: 'https://shop.test/scarf' });

  await request(app).delete(`/wishlists/${a.list.wishlist_id}`).set('Authorization', a.auth);

  const [items] = await pool.query('SELECT title FROM items WHERE wishlist_id = ?', [other.wishlist_id]);
  expect(items.map((row) => row.title)).toEqual(['Scarf']);
});

test("another user's delete is refused and nothing is removed (IT-06, IT-09)", async () => {
  const a = await makeFullList('cascade-owner');
  const b = await makeUser('cascade-stranger');

  const res = await request(app).delete(`/wishlists/${a.list.wishlist_id}`).set('Authorization', b.auth);
  expect(res.status).toBe(404);

  expect(await countRows(a.list.wishlist_id, a.itemIds)).toEqual({ wishlists: 1, items: 2, purchases: 1, logs: 2 });
});

test('deleting one item removes its purchase and nothing else (IT-09)', async () => {
  const a = await makeFullList('cascade-item');

  const res = await request(app).delete(`/wishlists/${a.list.wishlist_id}/items/${a.itemIds[0]}`).set('Authorization', a.auth);
  expect(res.status).toBe(204);

  expect(await countRows(a.list.wishlist_id, a.itemIds)).toEqual({ wishlists: 1, items: 1, purchases: 0, logs: 2 });
});

test('deleting a user removes their wishlists, items, purchases and share-log rows (IT-09)', async () => {
  const a = await makeFullList('cascade-user');

  await pool.query('DELETE FROM users WHERE user_id = ?', [a.userId]);

  expect(await countRows(a.list.wishlist_id, a.itemIds)).toEqual({ wishlists: 0, items: 0, purchases: 0, logs: 0 });
});