//This uses Austin's new method names, so it will fail on main until his branch merges.

const pool = require('../../src/db');
const userRepo = require('../../src/repositories/userRepository');

afterAll(async () => { await pool.end(); });

test('create then findByEmail returns the stored record', async () => {
  const email = `repo-${Date.now()}@listly.test`;
  const created = await userRepo.create(email, 'fake-hash');
  const found = await userRepo.findByEmail(email);

  expect(found).not.toBeNull();
  expect(found.user_id).toBe(created.user_id);
  expect(found.email).toBe(email);
});

test('findByEmail returns null for an unknown email', async () => {
  expect(await userRepo.findByEmail('nobody@listly.test')).toBeNull();
});