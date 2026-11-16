const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');

const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 255; //user.email is varchar(255) in the database
const MAX_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES  = 72; //bcrypt ignores everything after 72 bytes

// Dummy hash to mitigate timing when user is not found
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST); 

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function passwordFitsBcypt(password) {
  return typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES;
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
    if (typeof password !== 'string' || password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters.');
  }
  // T-114: longer than the users.email column would crash the INSERT with a 500.
  if (email.length > MAX_EMAIL_LENGTH) {
    throw httpError(400, `Email must be ${MAX_EMAIL_LENGTH} characters or fewer.`);
  }
  // T-114: bcrypt silently ignores everything past 72 bytes, so refuse longer passwords.
  if (!passwordFitsBcypt(password)) {
    throw httpError(400, `Password must be ${MAX_PASSWORD_BYTES} characters or fewer.`);
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
    /* T-114, SEC-05: always run a bcrypt compare, against DUMMY_HASH when the email is unknown, 
    so an unknown email takes as long as a wrong password and doesn't reveal which accounts exist.*/
  const ok = (await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)) && user;

  if (!ok) throw httpError(401, 'Invalid email or password.');

  return { token: issueToken(user), user: { user_id: user.user_id, email: user.email } };
}

module.exports = { register, login };