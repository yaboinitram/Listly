// T-40: POST /wishlists, the success case and every way it can be rejected.
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db');
const { makeUser } = require('../helpers/makeUser');

afterAll(async () => { await pool.end(); });

const create = (user, body) => {
  const req = request(app).post('/wishlists').set('Authorization', user.auth);
  return body === undefined ? req : req.send(body);
};
const lists = (user) => request(app).get('/wishlists').set('Authorization', user.auth);

test('201 with the new wishlist, which then shows up in the list', async () => {
  const a = await makeUser('wl-ok');
  const res = await create(a, { name: 'Birthday' });

  expect(res.status).toBe(201);
  expect(res.body).toEqual({ wishlist_id: expect.any(String), name: 'Birthday' });

  const listed = await lists(a);
  expect(listed.body.map((w) => w.name)).toEqual(['Birthday']);
});

test('the name is trimmed before it is saved', async () => {
  const a = await makeUser('wl-trim');
  const res = await create(a, { name: '   Holiday gifts   ' });

  expect(res.status).toBe(201);
  expect(res.body.name).toBe('Holiday gifts');
});

test('a name of exactly 100 characters is accepted', async () => {
  const a = await makeUser('wl-100');
  const res = await create(a, { name: 'a'.repeat(100) });

  expect(res.status).toBe(201);
  expect(res.body.name).toHaveLength(100);
});

test('400 on a name of 101 characters, and nothing is saved', async () => {
  const a = await makeUser('wl-101');
  const res = await create(a, { name: 'a'.repeat(101) });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Wishlist name must be 100 characters or fewer.' });
  expect((await lists(a)).body).toEqual([]);
});

test.each([
  ['no body', undefined],
  ['an empty object', {}],
  ['an empty name', { name: '' }],
  ['a name of only spaces', { name: '     ' }],
  ['a number as the name', { name: 42 }],
  ['null as the name', { name: null }],
  ['an object as the name', { name: { $ne: '' } }],
])('400 "name is required" for %s, and nothing is saved', async (_label, body) => {
  const a = await makeUser('wl-bad');
  const res = await create(a, body);

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Wishlist name is required.' });
  expect((await lists(a)).body).toEqual([]);
});

test('two users can use the same wishlist name', async () => {
  const a = await makeUser('wl-same-a');
  const b = await makeUser('wl-same-b');

  expect((await create(a, { name: 'Gifts' })).status).toBe(201);
  expect((await create(b, { name: 'Gifts' })).status).toBe(201);
});