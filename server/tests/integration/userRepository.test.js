//This uses Austin's new method names, so it will fail on main until his branch merges.

const pool = require('../../src/db');
const userRepo = require('../../src/repositories/userRepository');

afterAll(async () => { await pool.end(); });

test('createUser then findUserByEmail returns the stored record', async () => {
  const email = `repo-${Date.now()}@listly.test`;
  const created = await userRepo.createUser(email, 'fake-hash');
  const found = await userRepo.findUserByEmail(email);

  expect(found).not.toBeNull();
  expect(found.user_id).toBe(created.user_id);
  expect(found.email).toBe(email);
});

test('findUserByEmail returns null for an unknown email', async () => {
  expect(await userRepo.findUserByEmail('nobody@listly.test')).toBeNull();
});