const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/db');

afterAll(async () => { await pool.end(); });

const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

/** Puts a user straight into listly_test and signs a token the same way authService does,
so these tests depend only on the wishlist routes.*/
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

test('the wishlist router sits behind authenticate (T-32)', async () => {
  const res = await request(app).get('/wishlists');
  expect(res.status).toBe(401);
});

test('POST /wishlists returns 201 with the new wishlist (T-36)', async () => {
  const a = await makeUser('wl-create');
  const res = await request(app).post('/wishlists').set('Authorization', a.auth).send({ name: 'Birthday' });

  expect(res.status).toBe(201);
  expect(res.body).toEqual({ wishlist_id: expect.any(String), name: 'Birthday' });
});

test("GET /wishlists returns only the signed-in user's wishlists (T-37)", async () => {
  const a = await makeUser('wl-a');
  const b = await makeUser('wl-b');
  await request(app).post('/wishlists').set('Authorization', a.auth).send({ name: 'A list' });
  await request(app).post('/wishlists').set('Authorization', b.auth).send({ name: 'B list' });

  const res = await request(app).get('/wishlists').set('Authorization', a.auth);
  expect(res.status).toBe(200);
  expect(res.body.map((w) => w.name)).toEqual(['A list']);
});

test('POST then GET /wishlists/:id/items saves and lists the item (T-46)', async () => {
  const a = await makeUser('items');
  const list = (await request(app).post('/wishlists').set('Authorization', a.auth).send({ name: 'Gifts' })).body;

  const saved = await request(app)
    .post(`/wishlists/${list.wishlist_id}/items`)
    .set('Authorization', a.auth)
    .send(ITEM);
  expect(saved.status).toBe(201);
  expect(saved.body).toMatchObject({ wishlist_id: list.wishlist_id, title: 'Blue Kettle', source_url: ITEM.source_url });

  const listed = await request(app).get(`/wishlists/${list.wishlist_id}/items`).set('Authorization', a.auth);
  expect(listed.status).toBe(200);
  expect(listed.body).toHaveLength(1);
  expect(listed.body[0].item_id).toBe(saved.body.item_id);
});

test("another user's wishlist or an unknown ID returns 404, not 403 (T-42)", async () => {
  const a = await makeUser('own-a');
  const b = await makeUser('own-b');
  const aList = (await request(app).post('/wishlists').set('Authorization', a.auth).send({ name: 'Private' })).body;
  const missing = randomUUID();

  const responses = [
    await request(app).post(`/wishlists/${aList.wishlist_id}/items`).set('Authorization', b.auth).send(ITEM),
    await request(app).get(`/wishlists/${aList.wishlist_id}/items`).set('Authorization', b.auth),
    await request(app).post(`/wishlists/${missing}/items`).set('Authorization', a.auth).send(ITEM),
    await request(app).get(`/wishlists/${missing}/items`).set('Authorization', a.auth),
  ];
  for (const res of responses) expect(res.status).toBe(404);

  // Nothing was saved into user A's wishlist by user B.
  const aItems = await request(app).get(`/wishlists/${aList.wishlist_id}/items`).set('Authorization', a.auth);
  expect(aItems.body).toEqual([]);
});