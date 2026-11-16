// T-97: SQL injection tests on every input the API accepts.
//
// Every query uses ? placeholders, so a payload should only ever be treated as text.
// For each input this file checks that:
//   1. the payload is stored as plain text when it's valid, or rejected with a 4xx when it isn't
//   2. nothing returns a 500, and nobody gets logged in or sees data that isn't theirs
//   3. the tables still exist, and their row counts changed only by what the request should add
//
// Not covered yet: PATCH /wishlists/:id (rename). Add the payloads there once it's on main.
//
// The row-count checks assume one test file runs at a time, which `npm test` and
// `npm run test:integration` do (--runInBand). Running plain `npx jest` in parallel could shift the counts.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/db');

afterAll(async () => { await pool.end(); });

const PASSWORD = 'password123';
const TABLES = ['users', 'wishlists', 'items', 'purchases', 'retailers', 'share_access_log'];
const enc = encodeURIComponent;

// Classic payloads: always-true conditions, comment endings, stacked queries, UNION, quote
// variants, and an already URL-encoded one. None contain an "@", and all are 100 characters or fewer.
const PAYLOADS = [
  "' OR '1'='1",
  "' OR 1=1 --",
  "'; DROP TABLE users; --",
  '" OR ""="',
  '1; DELETE FROM wishlists; --',
  "' UNION SELECT user_id, email, password_hash FROM users --",
  "admin'--",
  "\\' OR 1=1 #",
  "') OR ('1'='1",
  "%27 OR %271%27=%271",
];

const VALID_ITEM = {
  title: 'Blue Kettle',
  price: 29.99,
  image_url: 'https://shop.test/kettle.jpg',
  source_url: 'https://shop.test/kettle',
};

const uniqueTag = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// Row count of every table. If a payload dropped or emptied one, this throws or changes.
async function snapshot() {
  const counts = {};
  for (const table of TABLES) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS n FROM ${table}`);
    counts[table] = Number(rows[0].n);
  }
  return counts;
}

// Inserts a user directly and signs a token, so only the inputs under test go through the API.
async function makeUser(tag) {
  const userId = randomUUID();
  const email = `${tag}-${uniqueTag()}@listly.test`;
  await pool.query('INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)', [userId, email, 'fake-hash']);
  const token = jwt.sign({ sub: userId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { userId, email, auth: `Bearer ${token}` };
}

let owner; // has one wishlist holding one item, and a share link
let list;
let item;
let shareId;
let victim; // has a real account with a known password

beforeAll(async () => {
  owner = await makeUser('inj-owner');
  list = (await request(app).post('/wishlists').set('Authorization', owner.auth).send({ name: 'Sentinel list' })).body;
  item = (await request(app).post(`/wishlists/${list.wishlist_id}/items`).set('Authorization', owner.auth).send(VALID_ITEM)).body;
  shareId = (await request(app).post(`/wishlists/${list.wishlist_id}/share`).set('Authorization', owner.auth)).body.share_id;

  const email = `inj-victim-${uniqueTag()}@listly.test`;
  const reg = await request(app).post('/auth/register').send({ email, password: PASSWORD });
  victim = { email, token: reg.body.token };
});

const ownerItems = () =>
  request(app).get(`/wishlists/${list.wishlist_id}/items`).set('Authorization', owner.auth);

describe('login', () => {
  test('sanity check: the real password logs in', async () => {
    const res = await request(app).post('/auth/login').send({ email: victim.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  test.each(PAYLOADS)('%s as the email gets 401 and no token', async (payload) => {
    const before = await snapshot();
    const res = await request(app).post('/auth/login').send({ email: payload, password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password.' });
    expect(await snapshot()).toEqual(before);
  });

  test.each(PAYLOADS)("%s as the password doesn't log into a real account", async (payload) => {
    const res = await request(app).post('/auth/login').send({ email: victim.email, password: payload });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test.each(PAYLOADS)("a real email followed by %s doesn't match that account", async (payload) => {
    const res = await request(app).post('/auth/login').send({ email: `${victim.email}${payload}`, password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });
});

describe('register', () => {
  test.each(PAYLOADS)('%s as the email is rejected as not a valid email', async (payload) => {
    const before = await snapshot();
    const res = await request(app).post('/auth/register').send({ email: payload, password: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'A valid email is required.' });
    expect(await snapshot()).toEqual(before);
  });

  // Whether the API accepts these addresses depends on its email rules. Either answer is safe:
  // a 400 means the payload never reached the database, and a 201 means it was stored as plain text.
  test.each([
    ["x'or'1'='1"],
    ["a');drop table users;--"],
  ])('an email with SQL in it (%s) is either rejected or stored as plain text', async (local) => {
    const email = `${local}-${uniqueTag()}@listly.test`;
    const before = await snapshot();

    const res = await request(app).post('/auth/register').send({ email, password: PASSWORD });
    expect([201, 400]).toContain(res.status);

    if (res.status === 400) {
      expect(res.body.error).toBeDefined();
      expect(await snapshot()).toEqual(before);
      return;
    }

    const [rows] = await pool.query('SELECT email FROM users WHERE email = ?', [email.toLowerCase()]);
    expect(rows).toHaveLength(1);
    expect(await snapshot()).toEqual({ ...before, users: before.users + 1 });

    const login = await request(app).post('/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  test('a password with SQL in it is hashed, and works for login', async () => {
    const email = `inj-pw-${uniqueTag()}@listly.test`;
    const password = "'; DROP TABLE users; --";
    const before = await snapshot();

    const res = await request(app).post('/auth/register').send({ email, password });
    expect(res.status).toBe(201);

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE email = ?', [email]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await snapshot()).toEqual({ ...before, users: before.users + 1 });

    const login = await request(app).post('/auth/login').send({ email, password });
    expect(login.status).toBe(200);
  });
});

describe('wishlist names', () => {
  test.each(PAYLOADS)('%s as a name is saved as plain text', async (payload) => {
    const before = await snapshot();
    const res = await request(app).post('/wishlists').set('Authorization', owner.auth).send({ name: payload });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(payload);
    expect(await snapshot()).toEqual({ ...before, wishlists: before.wishlists + 1 });

    const listed = await request(app).get('/wishlists').set('Authorization', owner.auth);
    expect(listed.body.map((w) => w.name)).toContain(payload);
  });
});

describe('item fields', () => {
  const save = (body) =>
    request(app).post(`/wishlists/${list.wishlist_id}/items`).set('Authorization', owner.auth).send(body);

  test.each(PAYLOADS)('%s as a title is saved as plain text', async (payload) => {
    const before = await snapshot();
    const res = await save({ ...VALID_ITEM, title: payload });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe(payload);
    expect(await snapshot()).toEqual({ ...before, items: before.items + 1 });
    expect((await ownerItems()).body.map((i) => i.title)).toContain(payload);
  });

  test.each(PAYLOADS)('%s as a price is rejected, because a price must be a number', async (payload) => {
    const before = await snapshot();
    const res = await save({ ...VALID_ITEM, price: payload });

    expect(res.status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  test.each(PAYLOADS)('%s as source_url is rejected, because it is not a link', async (payload) => {
    const before = await snapshot();
    const res = await save({ ...VALID_ITEM, source_url: payload });

    expect(res.status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  test.each(PAYLOADS)('%s inside a link query string is saved as plain text', async (payload) => {
    const url = `https://shop.test/p?q=${payload}`;
    const before = await snapshot();
    const res = await save({ ...VALID_ITEM, source_url: url, image_url: url });

    expect(res.status).toBe(201);
    expect(res.body.source_url).toBe(url);
    expect(res.body.image_url).toBe(url);
    expect(await snapshot()).toEqual({ ...before, items: before.items + 1 });
  });
});

describe('IDs in the URL', () => {
  const as = (method, path) => request(app)[method](path).set('Authorization', owner.auth);

  test.each(PAYLOADS)('%s as a wishlist ID gets 404 on every route', async (payload) => {
    const before = await snapshot();
    const w = enc(payload);
    const responses = [
      await as('get', `/wishlists/${w}/items`),
      await as('post', `/wishlists/${w}/items`).send(VALID_ITEM),
      await as('put', `/wishlists/${w}/items/${item.item_id}`).send(VALID_ITEM),
      await as('delete', `/wishlists/${w}/items/${item.item_id}`),
      await as('post', `/wishlists/${w}/share`),
    ];

    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    }
    expect(await snapshot()).toEqual(before);
  });

  test.each(PAYLOADS)('%s as an item ID gets 404 and changes nothing', async (payload) => {
    const before = await snapshot();
    const i = enc(payload);

    const put = await as('put', `/wishlists/${list.wishlist_id}/items/${i}`).send({ ...VALID_ITEM, title: 'Changed' });
    const del = await as('delete', `/wishlists/${list.wishlist_id}/items/${i}`);

    expect(put.status).toBe(404);
    expect(del.status).toBe(404);
    expect(await snapshot()).toEqual(before);
    expect((await ownerItems()).body.find((x) => x.item_id === item.item_id).title).toBe('Blue Kettle');
  });

  test.each(PAYLOADS)('%s as a share ID gets 404, even though a shared wishlist exists', async (payload) => {
    const res = await request(app).get(`/share/${enc(payload)}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Wishlist not found.' });
  });

  test('sanity check: the real share link still works', async () => {
    const res = await request(app).get(`/share/${shareId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Sentinel list');
  });
});

test('after every payload, the tables and the sentinel data are intact', async () => {
  const counts = await snapshot();
  expect(counts.users).toBeGreaterThanOrEqual(2); // owner and victim, at least
  expect(counts.wishlists).toBeGreaterThanOrEqual(1);
  expect(counts.items).toBeGreaterThanOrEqual(1);

  const mine = await request(app).get('/wishlists').set('Authorization', owner.auth);
  expect(mine.body.map((w) => w.wishlist_id)).toContain(list.wishlist_id);
  expect((await ownerItems()).body.map((i) => i.item_id)).toContain(item.item_id);
});