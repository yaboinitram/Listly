// T-35: every owner-scoped route rejects a request with no valid token.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/db');

afterAll(async () => { await pool.end(); });

const W = randomUUID();
const I = randomUUID();
const ITEM = { title: 'Blue Kettle', price: 29.99, source_url: 'https://shop.test/kettle' };

// Every route that sits behind authenticate. Add new owner-scoped routes here.
const OWNER_ROUTES = [
  ['post', '/wishlists', { name: 'Birthday' }],
  ['get', '/wishlists'],
  ['post', `/wishlists/${W}/items`, ITEM],
  ['get', `/wishlists/${W}/items`],
  ['put', `/wishlists/${W}/items/${I}`, ITEM],
  ['delete', `/wishlists/${W}/items/${I}`],
  ['post', `/wishlists/${W}/share`],
];

const send = (method, path, body, auth) => {
  let req = request(app)[method](path);
  if (auth !== undefined) req = req.set('Authorization', auth);
  return body ? req.send(body) : req;
};

describe.each(OWNER_ROUTES)('%s %s', (method, path, body) => {
  test('401 with no Authorization header', async () => {
    const res = await send(method, path, body);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Missing token.' });
  });

  test('401 with a garbage token', async () => {
    const res = await send(method, path, body, 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token.' });
  });

  test('401 with an expired token', async () => {
    const expired = jwt.sign({ sub: randomUUID(), email: 'x@listly.test' }, process.env.JWT_SECRET, { expiresIn: -60 });
    const res = await send(method, path, body, `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test('401 with a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: randomUUID(), email: 'x@listly.test' }, 'a-different-secret-that-is-long-enough-123', { expiresIn: '7d' });
    const res = await send(method, path, body, `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('routes that are meant to be public', () => {
  test('GET /health needs no token', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
  });

  test('GET /share/:shareId needs no token (an unknown ID is 404, not 401)', async () => {
    expect((await request(app).get(`/share/${randomUUID()}`)).status).toBe(404);
  });
});