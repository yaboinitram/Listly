const jwt = require('jsonwebtoken');
const authenticate = require('../../src/middleware/authenticate');
 
const SECRET = process.env.JWT_SECRET;
const USER = { sub: 'user-123', email: 'unit@listly.test' };
 
// A fake Express req/res/next, so no server or database is needed.
function run(authorization) {
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const next = jest.fn();
  authenticate(req, res, next);
  return { req, res, next };
}
 
const bearer = (token) => `Bearer ${token}`;
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
 
function expectRejected({ res, next }, message) {
  expect(res.statusCode).toBe(401);
  expect(res.body).toEqual({ error: message });
  expect(next).not.toHaveBeenCalled();
}
 
describe('authenticate middleware (T-34)', () => {
  test('a valid token calls next() and sets req.user', () => {
    const token = jwt.sign(USER, SECRET, { expiresIn: '7d' });
    const { req, res, next } = run(bearer(token));
 
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
    expect(req.user).toEqual({ user_id: USER.sub, email: USER.email });
  });
 
  test.each([
    ['no Authorization header', undefined],
    ['an empty header', ''],
    ['Bearer with no token', 'Bearer '],
    ['a different scheme', 'Basic abc123'],
    ['a token with no scheme', 'justatoken'],
  ])('401 "Missing token." for %s', (_name, header) => {
    expectRejected(run(header), 'Missing token.');
  });
 
  test('401 for an expired token', () => {
    const token = jwt.sign(USER, SECRET, { expiresIn: -60 });
    expectRejected(run(bearer(token)), 'Invalid or expired token.');
  });
 
  test('401 for a token signed with a different secret', () => {
    const token = jwt.sign(USER, 'some-other-secret-that-is-long-enough-123', { expiresIn: '7d' });
    expectRejected(run(bearer(token)), 'Invalid or expired token.');
  });
 
  test('401 when the payload is edited but the old signature is kept', () => {
    const token = jwt.sign(USER, SECRET, { expiresIn: '7d' });
    const [header, , signature] = token.split('.');
    const forged = b64url({ ...USER, sub: 'someone-else', exp: Math.floor(Date.now() / 1000) + 3600 });
    expectRejected(run(bearer(`${header}.${forged}.${signature}`)), 'Invalid or expired token.');
  });
 
  test('401 for an unsigned token (alg: none)', () => {
    const unsigned = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ ...USER, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    expectRejected(run(bearer(unsigned)), 'Invalid or expired token.');
  });
 
  test('401 for a garbage token', () => {
    expectRejected(run(bearer('not.a.jwt')), 'Invalid or expired token.');
  });
});
 