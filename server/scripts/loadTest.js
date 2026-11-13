/* T-95: checks the API against the test plan's performance targets (Section 6.2, PERF-03 to PERF-06).
Start the server first (npm run dev). Then, in a second terminal in server/: node scripts/loadTest.js
It makes its own account in listly_dev and deletes it at the end*/
require('dotenv').config({ quiet: true });
const pool = require('../src/db');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const PASSWORD = 'load-test-password';
const PEAK_CONNECTIONS = 10; // PERF-05 "peak load": the team's choice for a class demo
const PEAK_SECONDS = 20;
const LOGIN_CONNECTIONS = 5; // PERF-06
const LOGIN_SECONDS = 30;

// One request, timed from send until the whole response body has arrived.
async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const start = performance.now();
  try {
    const res = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, data, ms: performance.now() - start };
  } catch {
    return { status: 0, data: null, ms: performance.now() - start }; // server unreachable
  }
}

// Sends `count` requests, each one after the previous finishes.
async function inSequence(count, send) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(await send());
  return results;
}

// Keeps `connections` requests in flight at once until `seconds` have passed.
async function atOnce(connections, seconds, send) {
  const results = [];
  const stopAt = performance.now() + seconds * 1000;
  const worker = async () => {
    while (performance.now() < stopAt) results.push(await send());
  };
  await Promise.all(Array.from({ length: connections }, worker));
  return results;
}

// The time that 95% of requests finished within.
function percentile(sortedMs, p) {
  return sortedMs[Math.max(0, Math.ceil((p / 100) * sortedMs.length) - 1)];
}

function summarize(test, what, results, maxP95Ms) {
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const errors = results.filter((r) => r.status < 200 || r.status >= 300).length;
  const p95 = percentile(times, 95);
  return {
    test,
    what,
    requests: results.length,
    errors,
    'p50 ms': Math.round(percentile(times, 50)),
    'p95 ms': Math.round(p95),
    'max ms': Math.round(times[times.length - 1]),
    target: `p95 < ${maxP95Ms} ms, no errors`,
    result: errors === 0 && p95 < maxP95Ms ? 'PASS' : 'FAIL',
  };
}

const item = (n) => ({
  title: `Load test item ${n}`,
  price: 19.99,
  image_url: 'https://shop.test/item.jpg',
  source_url: `https://shop.test/item-${n}`,
});

async function setUp(email) {
  const reg = await call('POST', '/auth/register', { body: { email, password: PASSWORD } });
  if (reg.status !== 201) {
    throw new Error(`could not register a test account (status ${reg.status}). Is the server running at ${BASE_URL}?`);
  }
  const token = reg.data.token;

  /* PERF-04 reads a shared wishlist of 25 items. PERF-03 and PERF-05 write to a second 
  wishlist, so the shared one stays at 25.*/
  const shared = (await call('POST', '/wishlists', { token, body: { name: 'Load test: shared' } })).data;
  for (let n = 1; n <= 25; n++) {
    await call('POST', `/wishlists/${shared.wishlist_id}/items`, { token, body: item(n) });
  }
  const { share_id } = (await call('POST', `/wishlists/${shared.wishlist_id}/share`, { token })).data;
  const writes = (await call('POST', '/wishlists', { token, body: { name: 'Load test: writes' } })).data;

  return { token, shareId: share_id, writeListId: writes.wishlist_id };
}

async function main() {
  const email = `loadtest-${Date.now()}@listly.test`;
  console.log(`Load testing ${BASE_URL}. This takes about a minute.`);
  try {
    const s = await setUp(email);

    const addItem = () => call('POST', `/wishlists/${s.writeListId}/items`, { token: s.token, body: item(0) });
    const viewShare = () => call('GET', `/share/${s.shareId}`);
    const listWishlists = () => call('GET', '/wishlists', { token: s.token });
    const login = () => call('POST', '/auth/login', { body: { email, password: PASSWORD } });

    const mixed = [listWishlists, viewShare, addItem];
    let turn = 0;
    const peakMix = () => mixed[turn++ % mixed.length]();

    const rows = [
      summarize('PERF-03', 'POST /wishlists/:id/items, 100 in a row', await inSequence(100, addItem), 500),
      summarize('PERF-04', 'GET /share/:shareId (25 items), 100 in a row', await inSequence(100, viewShare), 500),
      summarize('PERF-05', `GET /wishlists, GET /share, POST items, ${PEAK_CONNECTIONS} at once for ${PEAK_SECONDS} s`,
        await atOnce(PEAK_CONNECTIONS, PEAK_SECONDS, peakMix), 1000),
      summarize('PERF-06', `POST /auth/login, ${LOGIN_CONNECTIONS} at once for ${LOGIN_SECONDS} s`,
        await atOnce(LOGIN_CONNECTIONS, LOGIN_SECONDS, login), 1000),
    ];

    console.table(rows);
    if (rows.some((row) => row.result === 'FAIL')) process.exitCode = 1;
  } finally {
    // Delete the test account. ON DELETE CASCADE removes its wishlists and items too.
    await pool.query('DELETE FROM users WHERE email = ?', [email]).catch(() => {});
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`Load test stopped: ${err.message}`);
  process.exitCode = 1;
});