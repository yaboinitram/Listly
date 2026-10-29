const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Swap the real MySQL repository for the in-memory fake (T-08), so no database is needed.
jest.mock('../../src/repositories/userRepository', () =>
  require('../fakes/userRepository')()
);

const authService = require('../../src/services/authService');
const userRepo = require('../../src/repositories/userRepository');

const PASSWORD = 'correct-horse-battery';
let n = 0;
const uniqueEmail = () => `unit-${++n}@listly.test`;

describe('authService.register', () => {
  test('returns a token and a user without password fields', async () => {
    const email = uniqueEmail();
    const result = await authService.register(email, PASSWORD);

    expect(typeof result.token).toBe('string');
    expect(result.user.email).toBe(email);
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('password_hash');
  });

  test('stores a bcrypt cost-12 hash, not the plaintext', async () => {
    const email = uniqueEmail();
    await authService.register(email, PASSWORD);

    const stored = await userRepo.findByEmail(email);
    expect(stored.password_hash).not.toBe(PASSWORD);
    expect(stored.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare(PASSWORD, stored.password_hash)).toBe(true);
  });

  test('lowercases the email before saving', async () => {
    const email = uniqueEmail();
    await authService.register(email.toUpperCase(), PASSWORD);
    expect(await userRepo.findByEmail(email)).not.toBeNull();
  });

  test('409 on a duplicate email', async () => {
    const email = uniqueEmail();
    await authService.register(email, PASSWORD);
    await expect(authService.register(email, PASSWORD)).rejects.toMatchObject({ status: 409 });
  });

  test.each([
    ['missing email', undefined, PASSWORD],
    ['malformed email', 'not-an-email', PASSWORD],
    ['missing password', 'a@listly.test', undefined],
    ['password under 8 characters', 'a@listly.test', 'short'],
    ['non-string password', 'a@listly.test', 12345678],
  ])('400 on %s', async (_name, email, password) => {
    await expect(authService.register(email, password)).rejects.toMatchObject({ status: 400 });
  });
});

describe('authService.login', () => {
  const email = uniqueEmail();

  beforeAll(async () => {
    await authService.register(email, PASSWORD);
  });

  test('returns a token that expires in 7 days', async () => {
    const { token, user } = await authService.login(email, PASSWORD);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    expect(user.email).toBe(email);
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
  });

  test('401 on wrong password and unknown email, with the same message', async () => {
    const wrongPw = await authService.login(email, 'wrong-password-123').catch((e) => e);
    const wrongEmail = await authService.login(uniqueEmail(), PASSWORD).catch((e) => e);

    expect(wrongPw.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPw.message).toBe(wrongEmail.message);
  });

  test('400 when email or password is missing', async () => {
    await expect(authService.login(undefined, PASSWORD)).rejects.toMatchObject({ status: 400 });
    await expect(authService.login(email, undefined)).rejects.toMatchObject({ status: 400 });
  });
});