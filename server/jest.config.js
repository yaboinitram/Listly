const base = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
    },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      // Resets listly_test before the integration suite only. Unit tests never touch MySQL.
      globalSetup: '<rootDir>/tests/globalSetup.js',
    },
  ],
};