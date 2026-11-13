const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/db');

afterAll(async () => { await pool.end(); });

const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

// Same helper as wishlistRoutes.test.js, but it also returns the email for the T-90 check.
async function makeUser(tag) {
  const userId = randomUUID();
  const email = uniqueEmail(tag);
  await pool.query(
    'INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)',
    [userId, email, 'fake-hash']
  );
  const token = jwt.sign({ sub: userId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { userId, email, auth: `Bearer ${token}` };
}

const SHARE_ID_FORMAT = /^[A-Za-z0-9]{32,}$/;

// A user with a wishlist named Birthday that holds two items.
async function makeUserWithList(tag) {
  const user = await makeUser(tag);
  const list = (await request(app).post('/wishlists').set('Authorization', user.auth).send({ name: 'Birthday' })).body;
  const itemsPath = `/wishlists/${list.wishlist_id}/items`;
  await request(app).post(itemsPath).set('Authorization', user.auth)
    .send({ title: 'Blue Kettle', price: 29.99, source_url: 'https://shop.test/kettle' });
  await request(app).post(itemsPath).set('Authorization', user.auth)
    .send({ title: 'Mystery gift', source_url: 'https://shop.test/mystery' });
  return { ...user, list };
}

const share = (user, wishlistId = user.list.wishlist_id) =>
  request(app).post(`/wishlists/${wishlistId}/share`).set('Authorization', user.auth);

const savedShareId = async (wishlistId) => {
  const [rows] = await pool.query('SELECT share_id FROM wishlists WHERE wishlist_id = ?', [wishlistId]);
  return rows[0].share_id;
};

test('the owner gets a 32+ character share ID, saved on the wishlist (T-79, T-80)', async () => {
  const a = await makeUserWithList('share');

  const res = await share(a);
  expect(res.status).toBe(201);
  expect(res.body).toEqual({ share_id: expect.stringMatching(SHARE_ID_FORMAT) });
  expect(await savedShareId(a.list.wishlist_id)).toBe(res.body.share_id);
});

test('sharing again returns the same link (T-80)', async () => {
  const a = await makeUserWithList('reshare');

  const first = await share(a);
  const second = await share(a);
  expect(second.status).toBe(200);
  expect(second.body.share_id).toBe(first.body.share_id);
});

test('a non-owner or an unknown wishlist gets 404, and nothing is shared (T-80)', async () => {
  const a = await makeUserWithList('private');
  const b = await makeUser('stranger');

  expect((await share(b, a.list.wishlist_id)).status).toBe(404);
  expect((await share(a, randomUUID())).status).toBe(404);
  expect(await savedShareId(a.list.wishlist_id)).toBeNull();
});

test('making a share link needs a token (T-32)', async () => {
  const a = await makeUserWithList('share-no-token');
  const res = await request(app).post(`/wishlists/${a.list.wishlist_id}/share`);
  expect(res.status).toBe(401);
});

test('GET /share/:shareId works with no token and returns the name and items (T-85)', async () => {
  const a = await makeUserWithList('view');
  const { share_id } = (await share(a)).body;

  const res = await request(app).get(`/share/${share_id}`); // no Authorization header
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Birthday');
  expect(res.body.items.map((item) => item.title).sort()).toEqual(['Blue Kettle', 'Mystery gift']);
});

test('the public response has only the name and item display fields (T-90)', async () => {
  const a = await makeUserWithList('fields');
  const { share_id } = (await share(a)).body;

  const res = await request(app).get(`/share/${share_id}`);
  expect(Object.keys(res.body).sort()).toEqual(['items', 'name']);
  for (const item of res.body.items) {
    expect(Object.keys(item).sort()).toEqual(['image_url', 'price', 'source_url', 'title']);
  }

  const text = JSON.stringify(res.body);
  expect(text).not.toContain(a.userId);
  expect(text).not.toContain(a.email);
  expect(text).not.toContain(a.list.wishlist_id);
});

test('an unknown share ID returns 404 (T-85)', async () => {
  const res = await request(app).get(`/share/${'0'.repeat(32)}`);
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'Wishlist not found.' });
});

test.each(['post', 'put', 'patch', 'delete'])(
  '%s on /share/:shareId gets 405 and changes nothing (T-91)',
  async (method) => {
    const a = await makeUserWithList(`readonly-${method}`);
    const { share_id } = (await share(a)).body;

    const res = await request(app)[method](`/share/${share_id}`).send({ name: 'Changed', title: 'Changed' });
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('GET');

    const after = await request(app).get(`/share/${share_id}`);
    expect(after.body.name).toBe('Birthday');
    expect(after.body.items).toHaveLength(2);
  }
);

test('other paths under /share have no write routes (T-91)', async () => {
  expect((await request(app).post('/share')).status).toBe(404);
  expect((await request(app).post(`/share/${'a'.repeat(32)}/items`)).status).toBe(404);
});