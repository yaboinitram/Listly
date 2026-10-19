const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db');

afterAll(async () => { await pool.end(); });

test('GET /health reports the database is connected', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.database).toBe('connected');
});