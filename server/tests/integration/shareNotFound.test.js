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

// A shared wishlist with one item. Returns the owner, the list, and its share ID.
async function makeSharedList(tag) {
  const user = await makeUser(tag);
  const list = (await request(app).post('/wishlists').set('Authorization', user.auth).send({ name: 'Birthday' })).body;
  await request(app).post(`/wishlists/${list.wishlist_id}/items`).set('Authorization', user.auth)
    .send({ title: 'Blue Kettle', price: 29.99, source_url: 'https://shop.test/kettle' });
  const shared = await request(app).post(`/wishlists/${list.wishlist_id}/share`).set('Authorization', user.auth);
  return { ...user, list, shareId: shared.body.share_id };
}

// T-102: every "not found" is the same JSON answer, never an HTML error page.
function expectNotFound(res) {
  expect(res.status).toBe(404);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.body).toEqual({ error: 'Wishlist not found.' });
}

test('an ID that was never issued returns 404 (T-100)', async () => {
  expectNotFound(await request(app).get(`/share/${'0'.repeat(32)}`));
});

test('a real link with one character changed returns 404 (T-100)', async () => {
  const a = await makeSharedList('altered');
  const last = a.shareId.slice(-1);
  const altered = a.shareId.slice(0, -1) + (last === '0' ? '1' : '0');

  expect((await request(app).get(`/share/${a.shareId}`)).status).toBe(200);
  expectNotFound(await request(app).get(`/share/${altered}`));
});

test("a deleted wishlist's link stops working (T-100, T-137)", async () => {
  const a = await makeSharedList('deleted');
  expect((await request(app).get(`/share/${a.shareId}`)).status).toBe(200);

  await request(app).delete(`/wishlists/${a.list.wishlist_id}`).set('Authorization', a.auth);

  expectNotFound(await request(app).get(`/share/${a.shareId}`));
});

test.each([
  ['no ID', '/share'],
  ['an empty ID', '/share/'],
  ['an ID that is too short', '/share/abc123'],
  ['an ID that is too long', `/share/${'a'.repeat(65)}`],
  ['a symbol in the ID', `/share/${'a'.repeat(31)}-`],
  ['an encoded path trick', '/share/..%2F..%2Fetc%2Fpasswd'],
  ['broken %-encoding', '/share/%E0%A4%A'],
  ['extra path parts', `/share/${'a'.repeat(32)}/items`],
])('%s gets JSON 404, not an error page (T-102)', async (_label, path) => {
  expectNotFound(await request(app).get(path));
});

test('a write to /share with no ID also gets JSON 404 (T-91, T-102)', async () => {
  expectNotFound(await request(app).post('/share'));
});