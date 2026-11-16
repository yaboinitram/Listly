const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db');
const { makeUser } = require('../helpers/makeUser');

afterAll(async () => { await pool.end(); });

// The page a share link opens. It's static HTML; its script reads GET /share/:shareId.

async function sharedList(tag) {
  const user = await makeUser(tag);
  const auth = (r) => r.set('Authorization', user.auth);
  const list = (await auth(request(app).post('/wishlists')).send({ name: 'Birthday' })).body;
  await auth(request(app).post(`/wishlists/${list.wishlist_id}/items`))
    .send({ title: 'Blue Kettle', price: 29.99, image_url: 'https://cdn.shop.test/kettle.png', source_url: 'https://shop.test/kettle' });
  const { share_id: shareId } = (await auth(request(app).post(`/wishlists/${list.wishlist_id}/share`))).body;
  return shareId;
}

test('/s/:shareId serves the share page without signing in', async () => {
  const shareId = await sharedList('page');
  const res = await request(app).get(`/s/${shareId}`);

  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
  expect(res.text).toContain('/s/assets/share.js');
});

test('the page may show product photos from other sites, but only runs scripts from this server', async () => {
  const shareId = await sharedList('csp');
  const csp = (await request(app).get(`/s/${shareId}`)).headers['content-security-policy'];

  expect(csp).toMatch(/img-src [^;]*https:/);
  expect(csp).toMatch(/script-src 'self'(;|$)/);
});

test('the page\'s script, styles and logo are served', async () => {
  for (const file of ['share.js', 'share.css', 'logo.png']) {
    const res = await request(app).get(`/s/assets/${file}`);
    expect(res.status).toBe(200);
  }
});

test('the page and the data it loads agree for a real link', async () => {
  const shareId = await sharedList('chain');
  expect((await request(app).get(`/s/${shareId}`)).status).toBe(200);

  const data = await request(app).get(`/share/${shareId}`);
  expect(data.body).toEqual({
    name: 'Birthday',
    items: [{ title: 'Blue Kettle', price: '29.99', image_url: 'https://cdn.shop.test/kettle.png', source_url: 'https://shop.test/kettle' }],
  });
});

test('outside /s/assets, files from web/ are not served', async () => {
  expect((await request(app).get('/s/assets/../share.html')).status).not.toBe(200);
  expect((await request(app).get('/web/share.html')).status).toBe(404);
});
