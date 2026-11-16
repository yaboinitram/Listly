const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db');

afterAll(async () => { await pool.end(); });

const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

const PASSWORD = 'password123';

async function timedLogin(email, password) {
  const start = performance.now();
  const res = await request(app).post('/auth/login').send({ email, password });
  return { res, ms: performance.now() - start };
}

const average = (numbers) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;

test('a wrong password and an unknown email take about the same time (T-114, SEC-05)', async () => {
  const email = uniqueEmail('timing');
  await request(app).post('/auth/register').send({ email, password: PASSWORD });

  const wrongPassword = [];
  const unknownEmail = [];
  for (let i = 0; i < 5; i++) {
    const a = await timedLogin(email, 'wrong-password');
    const b = await timedLogin(uniqueEmail('nobody'), 'wrong-password');
    expect(a.res.status).toBe(401);
    expect(b.res.status).toBe(401);
    expect(b.res.body).toEqual(a.res.body); // SEC-04: the same message either way
    wrongPassword.push(a.ms);
    unknownEmail.push(b.ms);
  }

  // Before the fix an unknown email answered about 80 times faster. Half leaves room for noise.
  expect(average(unknownEmail)).toBeGreaterThan(average(wrongPassword) * 0.5);
});

test('an email over 255 characters gets 400, not a server error (T-114)', async () => {
  const email = `${'a'.repeat(250)}@listly.test`;

  const res = await request(app).post('/auth/register').send({ email, password: PASSWORD });
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Email must be 255 characters or fewer.' });
});

test('a password over 72 characters gets 400, because bcrypt would cut it off (T-114)', async () => {
  const res = await request(app).post('/auth/register').send({ email: uniqueEmail('long-pw'), password: 'p'.repeat(73) });
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Password must be 72 characters or fewer.' });
});

test('a password of exactly 72 characters is still accepted (T-114)', async () => {
  const res = await request(app).post('/auth/register').send({ email: uniqueEmail('pw-72'), password: 'p'.repeat(72) });
  expect(res.status).toBe(201);
});