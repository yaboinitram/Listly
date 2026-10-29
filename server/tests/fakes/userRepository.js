const { randomUUID } = require('crypto');

// In-memory stand-in for userRepository, so service tests don't need MySQL.
function createFakeUserRepository() {
  const users = new Map();
  return {
    async create(email, passwordHash) {
      if ([...users.values()].some((u) => u.email === email)) {
        const err = new Error('Duplicate entry');
        err.code = 'ER_DUP_ENTRY'; // same code MySQL throws
        throw err;
      }
      const user = { user_id: randomUUID(), email, password_hash: passwordHash };
      users.set(user.user_id, user);
      return { user_id: user.user_id, email };
    },
    async findByEmail(email) {
      return [...users.values()].find((u) => u.email === email) || null;
    },
  };
}

module.exports = createFakeUserRepository;