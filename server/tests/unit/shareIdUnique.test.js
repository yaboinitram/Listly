const { generateShareId } = require('../../src/shareId');

// T-83: 10,000 generated IDs have no duplicates. (The forced-collision retry is in shareService.test.js.)
test('10,000 generated share IDs are all different, and all well-formed', () => {
  const ids = new Set();
  for (let i = 0; i < 10000; i++) {
    const id = generateShareId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    ids.add(id);
  }
  expect(ids.size).toBe(10000);
});