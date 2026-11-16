const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/db');

afterAll(async () => { await pool.end(); });

const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

// Same helper as wishlistRoutes.test.js: a user in listly_test plus a signed token.
async function makeUser(tag) {
  const userId = randomUUID();
  const email = uniqueEmail(tag);
  await pool.query(
    'INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)',
    [userId, email, 'fake-hash']
  );
  const token = jwt.sign({ sub: userId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { userId, auth: `Bearer ${token}` };
}

const ITEM = { title: 'Blue Kettle', price: 29.99, source_url: 'https://shop.test/kettle' };

const createList = async (user, name) =>
  (await request(app).post('/wishlists').set('Authorization', user.auth).send({ name })).body;
const addItem = (user, list) =>
  request(app).post(`/wishlists/${list.wishlist_id}/items`).set('Authorization', user.auth).send(ITEM);
const getLists = (user) => request(app).get('/wishlists').set('Authorization', user.auth);

test('GET /wishlists includes item_count and share_id for each list (T-114)', async () => {
  const a = await makeUser('summary');
  const gifts = await createList(a, 'Gifts');
  await createList(a, 'Empty');
  await addItem(a, gifts);
  await addItem(a, gifts);
  const { share_id } = (await request(app).post(`/wishlists/${gifts.wishlist_id}/share`).set('Authorization', a.auth)).body;

  const res = await getLists(a);
  expect(res.status).toBe(200);
  expect(res.body).toEqual([
    { wishlist_id: expect.any(String), name: 'Empty', share_id: null, item_count: 0 },
    { wishlist_id: gifts.wishlist_id, name: 'Gifts', share_id, item_count: 2 },
  ]);
});

test('PATCH /wishlists/:id renames the list, and the new name sticks (T-136)', async () => {
  const a = await makeUser('rename');
  const list = await createList(a, 'Old name');

  const res = await request(app).patch(`/wishlists/${list.wishlist_id}`).set('Authorization', a.auth)
    .send({ name: '  New name  ' });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ wishlist_id: list.wishlist_id, name: 'New name' });

  expect((await getLists(a)).body.map((w) => w.name)).toEqual(['New name']);
});

test('PATCH with an empty name returns 400 and keeps the old name (T-136)', async () => {
  const a = await makeUser('rename-empty');
  const list = await createList(a, 'Keep me');

  const res = await request(app).patch(`/wishlists/${list.wishlist_id}`).set('Authorization', a.auth)
    .send({ name: '' });
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Wishlist name is required.' });

  expect((await getLists(a)).body.map((w) => w.name)).toEqual(['Keep me']);
});

test('DELETE /wishlists/:id removes the list and leaves no items behind (T-137)', async () => {
  const a = await makeUser('delete-list');
  const list = await createList(a, 'Old stuff');
  await addItem(a, list);
  await addItem(a, list);

  const res = await request(app).delete(`/wishlists/${list.wishlist_id}`).set('Authorization', a.auth);
  expect(res.status).toBe(204);
  expect((await getLists(a)).body).toEqual([]);

  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM items WHERE wishlist_id = ?', [list.wishlist_id]);
  expect(rows[0].n).toBe(0);

  const again = await request(app).delete(`/wishlists/${list.wishlist_id}`).set('Authorization', a.auth);
  expect(again.status).toBe(404);
});

test("another user's list can't be renamed or deleted (T-136, T-137)", async () => {
  const a = await makeUser('list-owner');
  const b = await makeUser('list-intruder');
  const list = await createList(a, 'Mine');

  const patch = await request(app).patch(`/wishlists/${list.wishlist_id}`).set('Authorization', b.auth)
    .send({ name: 'Hacked' });
  const del = await request(app).delete(`/wishlists/${list.wishlist_id}`).set('Authorization', b.auth);
  expect(patch.status).toBe(404);
  expect(del.status).toBe(404);

  expect((await getLists(a)).body.map((w) => w.name)).toEqual(['Mine']);
});

test('an unknown wishlist ID returns 404 (T-136, T-137)', async () => {
  const a = await makeUser('unknown-list');
  const path = `/wishlists/${randomUUID()}`;

  expect((await request(app).patch(path).set('Authorization', a.auth).send({ name: 'X' })).status).toBe(404);
  expect((await request(app).delete(path).set('Authorization', a.auth)).status).toBe(404);
});

test('rename and delete need a token (T-32)', async () => {
  const a = await makeUser('list-no-token');
  const list = await createList(a, 'Mine');

  expect((await request(app).patch(`/wishlists/${list.wishlist_id}`).send({ name: 'X' })).status).toBe(401);
  expect((await request(app).delete(`/wishlists/${list.wishlist_id}`)).status).toBe(401);
});