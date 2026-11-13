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

// A user with one wishlist that holds one item.
async function makeUserWithItem(tag) {
  const user = await makeUser(tag);
  const list = (await request(app).post('/wishlists').set('Authorization', user.auth).send({ name: 'Gifts' })).body;
  const item = (await request(app)
    .post(`/wishlists/${list.wishlist_id}/items`)
    .set('Authorization', user.auth)
    .send(ITEM)).body;
  return { ...user, list, item, itemPath: `/wishlists/${list.wishlist_id}/items/${item.item_id}` };
}

const listItems = (user) =>
  request(app).get(`/wishlists/${user.list.wishlist_id}/items`).set('Authorization', user.auth);

test('PUT saves the edit, and it is still there on the next read (T-73)', async () => {
  const a = await makeUserWithItem('edit');
  const edit = {
    title: 'Red Kettle',
    price: 24.5,
    image_url: 'https://shop.test/red.jpg',
    source_url: 'https://shop.test/red-kettle',
  };

  const res = await request(app).put(a.itemPath).set('Authorization', a.auth).send(edit);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ item_id: a.item.item_id, title: 'Red Kettle' });

  const listed = await listItems(a);
  expect(listed.body).toHaveLength(1);
  expect(listed.body[0]).toMatchObject({
    title: 'Red Kettle',
    image_url: edit.image_url,
    source_url: edit.source_url,
  });
  expect(Number(listed.body[0].price)).toBe(24.5); // DECIMAL columns come back as text
});

test('PUT with the same values still returns 200 (T-73)', async () => {
  const a = await makeUserWithItem('same');
  const res = await request(app).put(a.itemPath).set('Authorization', a.auth).send(ITEM);
  expect(res.status).toBe(200);
});

test('PUT with invalid input returns 400 and changes nothing (T-73)', async () => {
  const a = await makeUserWithItem('bad-edit');

  const res = await request(app).put(a.itemPath).set('Authorization', a.auth).send({ ...ITEM, title: '' });
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Item title is required.' });

  const listed = await listItems(a);
  expect(listed.body[0].title).toBe('Blue Kettle');
});

test('DELETE returns 204 and the item is gone (T-74)', async () => {
  const a = await makeUserWithItem('delete');

  const res = await request(app).delete(a.itemPath).set('Authorization', a.auth);
  expect(res.status).toBe(204);
  expect((await listItems(a)).body).toEqual([]);

  const again = await request(app).delete(a.itemPath).set('Authorization', a.auth);
  expect(again.status).toBe(404);
});

test("another user's item returns 404 and is left unchanged (T-73, T-74)", async () => {
  const a = await makeUserWithItem('owner');
  const b = await makeUser('intruder');

  const put = await request(app).put(a.itemPath).set('Authorization', b.auth).send({ ...ITEM, title: 'Hacked' });
  const del = await request(app).delete(a.itemPath).set('Authorization', b.auth);
  expect(put.status).toBe(404);
  expect(del.status).toBe(404);

  const listed = await listItems(a);
  expect(listed.body).toHaveLength(1);
  expect(listed.body[0].title).toBe('Blue Kettle');
});

test("an item reached through another wishlist's path returns 404 (T-73, T-74)", async () => {
  const a = await makeUserWithItem('wrong-list');
  const other = (await request(app).post('/wishlists').set('Authorization', a.auth).send({ name: 'Other' })).body;
  const wrongPath = `/wishlists/${other.wishlist_id}/items/${a.item.item_id}`;

  expect((await request(app).put(wrongPath).set('Authorization', a.auth).send(ITEM)).status).toBe(404);
  expect((await request(app).delete(wrongPath).set('Authorization', a.auth)).status).toBe(404);
  expect((await listItems(a)).body).toHaveLength(1);
});

test('an unknown item ID returns 404 (T-73, T-74)', async () => {
  const a = await makeUserWithItem('missing');
  const missingPath = `/wishlists/${a.list.wishlist_id}/items/${randomUUID()}`;

  expect((await request(app).put(missingPath).set('Authorization', a.auth).send(ITEM)).status).toBe(404);
  expect((await request(app).delete(missingPath).set('Authorization', a.auth)).status).toBe(404);
});

test('PUT and DELETE need a token (T-32)', async () => {
  const a = await makeUserWithItem('no-token');

  expect((await request(app).put(a.itemPath).send(ITEM)).status).toBe(401);
  expect((await request(app).delete(a.itemPath)).status).toBe(401);
});