// Wrap the real randomBytes in jest.fn() so the test can check it was used.
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomBytes: jest.fn(actual.randomBytes) };
});

const crypto = require('crypto');
const { generateShareId } = require('../../src/shareId');

describe('generateShareId (T-79)', () => {
  test('is 32 characters of letters and digits only', () => {
    const id = generateShareId();
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[A-Za-z0-9]{32,}$/);
  });

  test('comes from crypto.randomBytes, not Math.random', () => {
    generateShareId();
    expect(crypto.randomBytes).toHaveBeenCalledWith(16);
  });

  test('gives a different ID every time', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateShareId()));
    expect(ids.size).toBe(1000);
  });
});