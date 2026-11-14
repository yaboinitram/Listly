// T-44: user B can never see, change or confirm the existence of user A's data.
// A stranger's ID and an ID that doesn't exist must look exactly the same (404, same body).
const request = require('supertest');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/db');
const { makeUser } = require('../helpers/makeUser');

afterAll(async () => { await pool.end(); });

const ITEM = { title: 'Blue Kettle', price: 29.99, source_url: 'https://shop.test/kettle' };

// User A has a wishlist holding one item. User B has nothing.
async function setup() {
  const a = await makeUser('own-a');
  const b = await makeUser('own-b');
  const list = (await request(app).post('/wishlists').set('Authorization', a.auth).send({ name: 'Private' })).body;
  const item = (await request(app)
    .post(`/wishlists/${list.wishlist_id}/items`)
    .set('Authorization', a.auth)
    .send(ITEM)).body;
  return { a, b, list, item };
}

const as = (user, method, path, body) => {
  const req = request(app)[method](path).set('Authorization', user.auth);
  return body ? req.send(body) : req;
};

// Every route that takes a wishlist or item ID, as [label, method, buildPath(listId, itemId), body].
const ID_ROUTES = [
  ['POST items', 'post', (w) => `/wishlists/${w}/items`, ITEM],
  ['GET items', 'get', (w) => `/wishlists/${w}/items`],
  ['PUT item', 'put', (w, i) => `/wishlists/${w}/items/${i}`, ITEM],
  ['DELETE item', 'delete', (w, i) => `/wishlists/${w}/items/${i}`],
  ['POST share', 'post', (w) => `/wishlists/${w}/share`],
];

describe.each(ID_ROUTES)('%s', (_label, method, buildPath, body) => {
  test("B gets the same 404 for A's IDs as for IDs that don't exist", async () => {
    const { b, list, item } = await setup();

    const stranger = await as(b, method, buildPath(list.wishlist_id, item.item_id), body);
    const missing = await as(b, method, buildPath(randomUUID(), randomUUID()), body);

    expect(stranger.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(stranger.body).toEqual(missing.body);
  });
});

test("A's wishlist never appears in B's wishlist list", async () => {
  const { a, b, list } = await setup();
  await request(app).post('/wishlists').set('Authorization', b.auth).send({ name: 'Mine' });

  const bLists = (await as(b, 'get', '/wishlists')).body;
  expect(bLists.map((w) => w.name)).toEqual(['Mine']);
  expect(bLists.map((w) => w.wishlist_id)).not.toContain(list.wishlist_id);

  const aLists = (await as(a, 'get', '/wishlists')).body;
  expect(aLists.map((w) => w.wishlist_id)).toContain(list.wishlist_id);
});

test("after B's attempts, A's data is unchanged and A's wishlist is not shared", async () => {
  const { a, b, list, item } = await setup();
  const base = `/wishlists/${list.wishlist_id}`;

  await as(b, 'post', `${base}/items`, { ...ITEM, title: 'Planted' });
  await as(b, 'put', `${base}/items/${item.item_id}`, { ...ITEM, title: 'Hacked' });
  await as(b, 'delete', `${base}/items/${item.item_id}`);
  await as(b, 'post', `${base}/share`);

  const items = (await as(a, 'get', `${base}/items`)).body;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ item_id: item.item_id, title: 'Blue Kettle' });

  const [rows] = await pool.query('SELECT share_id FROM wishlists WHERE wishlist_id = ?', [list.wishlist_id]);
  expect(rows[0].share_id).toBeNull();
});

test("A's own requests still work, so the 404s above are about ownership, not a broken route", async () => {
  const { a, list, item } = await setup();
  const base = `/wishlists/${list.wishlist_id}`;

  expect((await as(a, 'get', `${base}/items`)).status).toBe(200);
  expect((await as(a, 'put', `${base}/items/${item.item_id}`, ITEM)).status).toBe(200);
  expect((await as(a, 'delete', `${base}/items/${item.item_id}`)).status).toBe(204);
});