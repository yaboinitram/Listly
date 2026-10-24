const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/db');

const PASSWORD = 'correct-horse-battery';
const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

afterAll(async () => { await pool.end(); });

describe('POST /auth/register', () => {
  test('201 with a token and user on valid signup', async () => {
    const email = uniqueEmail('reg');
    const res = await request(app).post('/auth/register').send({ email, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.user_id).toBeDefined();
  });

  test('409 on a duplicate email and no second account', async () => {
    const email = uniqueEmail('dup');
    await request(app).post('/auth/register').send({ email, password: PASSWORD });
    const res = await request(app).post('/auth/register').send({ email, password: PASSWORD });

    expect(res.status).toBe(409);

    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM users WHERE email = ?', [email]);
    expect(rows[0].n).toBe(1);
  });

  test('409 when the same email differs only by case', async () => {
    const email = uniqueEmail('case');
    await request(app).post('/auth/register').send({ email, password: PASSWORD });
    const res = await request(app)
      .post('/auth/register')
      .send({ email: email.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(409);
  });

  test.each([
    ['missing email', { password: PASSWORD }],
    ['malformed email', { email: 'not-an-email', password: PASSWORD }],
    ['missing password', { email: 'a@listly.test' }],
    ['password under 8 characters', { email: 'a@listly.test', password: 'short' }],
    ['non-string password', { email: 'a@listly.test', password: 12345678 }],
    ['empty body', {}],
  ])('400 on %s', async (_name, body) => {
    const res = await request(app).post('/auth/register').send(body);
    expect(res.status).toBe(400);
  });

  test('stores a bcrypt hash, never the plaintext password', async () => {
    const email = uniqueEmail('hash');
    await request(app).post('/auth/register').send({ email, password: PASSWORD });

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE email = ?', [email]);
    expect(rows[0].password_hash).not.toBe(PASSWORD);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
  });
});

describe('POST /auth/login', () => {
  const email = uniqueEmail('login');

  beforeAll(async () => {
    await request(app).post('/auth/register').send({ email, password: PASSWORD });
  });

  test('200 with a token that expires in 7 days', async () => {
    const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.email).toBe(email);
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
  });

  test('200 when the email is typed in a different case', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
  });

  test('401 on wrong password and on unknown email, with the same message', async () => {
    const wrongPw = await request(app).post('/auth/login').send({ email, password: 'wrong-password-123' });
    const wrongEmail = await request(app)
      .post('/auth/login')
      .send({ email: uniqueEmail('nobody'), password: PASSWORD });

    expect(wrongPw.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPw.body.error).toBe(wrongEmail.body.error);
  });

  test.each([
    ['missing password', (e) => ({ email: e })],
    ['missing email', () => ({ password: PASSWORD })],
    ['empty body', () => ({})],
  ])('400 on %s', async (_name, makeBody) => {
    const res = await request(app).post('/auth/login').send(makeBody(email));
    expect(res.status).toBe(400);
  });
});