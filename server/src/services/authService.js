const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');

const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.user_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(email, password) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    throw httpError(400, 'A valid email is required.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters.');
  }
  email = email.trim().toLowerCase();

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const user = await userRepo.create(email, hash);
    return { token: issueToken(user), user };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw httpError(409, 'An account with that email already exists.');
    }
    throw err;
  }
}

async function login(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw httpError(400, 'Email and password are required.');
  }
  const user = await userRepo.findByEmail(email.trim().toLowerCase());
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw httpError(401, 'Invalid email or password.');

  return { token: issueToken(user), user: { user_id: user.user_id, email: user.email } };
}

module.exports = { register, login };