const util = require('util');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db');

const PASSWORD = 'super-secret-passphrase-1';
const BCRYPT_RE = /\$2[aby]\$\d{2}\$/;
const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@listly.test`;

// Collect everything written to the console, formatted the way console would print it.
function captureLogs() {
  const spies = ['log', 'info', 'warn', 'error'].map((m) =>
    jest.spyOn(console, m).mockImplementation(() => {})
  );
  return () =>
    spies
      .flatMap((s) => s.mock.calls)
      .map((args) => args.map((a) => util.inspect(a, { depth: 6 })).join(' '))
      .join('\n');
}

afterEach(() => { jest.restoreAllMocks(); });
afterAll(async () => { await pool.end(); });

describe('API responses never contain the password or hash (T-24)', () => {
  test('register and login responses', async () => {
    const email = uniqueEmail('resp');
    const reg = await request(app).post('/auth/register').send({ email, password: PASSWORD });
    const login = await request(app).post('/auth/login').send({ email, password: PASSWORD });

    for (const res of [reg, login]) {
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(PASSWORD);
      expect(raw).not.toMatch(BCRYPT_RE);
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('password_hash');
    }
  });

  test('error responses (409, 401, 400)', async () => {
    const email = uniqueEmail('err');
    await request(app).post('/auth/register').send({ email, password: PASSWORD });

    const responses = [
      await request(app).post('/auth/register').send({ email, password: PASSWORD }), // 409
      await request(app).post('/auth/login').send({ email, password: 'wrong-password-123' }), // 401
      await request(app).post('/auth/register').send({ email: 'bad', password: PASSWORD }), // 400
    ];
    for (const res of responses) {
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(PASSWORD);
      expect(raw).not.toMatch(BCRYPT_RE);
    }
  });
});

describe('server logs never contain the password or hash (T-25)', () => {
  test('normal register and login', async () => {
    const getLogs = captureLogs();
    const email = uniqueEmail('log');
    await request(app).post('/auth/register').send({ email, password: PASSWORD });
    await request(app).post('/auth/login').send({ email, password: PASSWORD });
    await request(app).post('/auth/login').send({ email, password: 'wrong-password-123' });

    expect(getLogs()).not.toContain(PASSWORD);
    expect(getLogs()).not.toMatch(BCRYPT_RE);
  });

  test('a database failure logs without leaking the hash from err.sql', async () => {
    const getLogs = captureLogs();
    const fakeHash = '$2b$12$FAKEHASHFAKEHASHFAKEHASHFAKEHASHFAKEHASHFAKEHASHFAKEHA';
    const dbError = Object.assign(new Error('Connection lost'), {
      code: 'PROTOCOL_CONNECTION_LOST',
      // mysql2 attaches the interpolated query to its errors
      sql: `INSERT INTO users (user_id, email, password_hash) VALUES ('id', 'x@listly.test', '${fakeHash}')`,
    });
    jest.spyOn(pool, 'query').mockRejectedValueOnce(dbError);

    const res = await request(app)
      .post('/auth/register')
      .send({ email: uniqueEmail('boom'), password: PASSWORD });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error.');
    expect(getLogs()).toContain('PROTOCOL_CONNECTION_LOST'); // it did log something useful
    expect(getLogs()).not.toContain(fakeHash);
    expect(getLogs()).not.toContain(PASSWORD);
  });
});