// T-50: POST /wishlists/:id/items, saving an item through the API.
const request = require('supertest');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/db');
const { makeUser } = require('../helpers/makeUser');

afterAll(async () => { await pool.end(); });

const VALID = {
  title: 'Blue Kettle',
  price: 29.99,
  image_url: 'https://shop.test/kettle.jpg',
  source_url: 'https://shop.test/kettle',
};

async function makeUserWithList(tag) {
  const user = await makeUser(tag);
  const list = (await request(app).post('/wishlists').set('Authorization', user.auth).send({ name: 'Gifts' })).body;
  return { ...user, list };
}

const save = (user, body, wishlistId = user.list.wishlist_id) =>
  request(app).post(`/wishlists/${wishlistId}/items`).set('Authorization', user.auth).send(body);
const items = (user) =>
  request(app).get(`/wishlists/${user.list.wishlist_id}/items`).set('Authorization', user.auth);

test('201 with the saved item, and it appears when the list is read back', async () => {
  const a = await makeUserWithList('item-ok');
  const res = await save(a, VALID);

  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    item_id: expect.any(String),
    wishlist_id: a.list.wishlist_id,
    title: 'Blue Kettle',
    image_url: VALID.image_url,
    source_url: VALID.source_url,
  });

  const listed = await items(a);
  expect(listed.body).toHaveLength(1);
  expect(listed.body[0].item_id).toBe(res.body.item_id);
  expect(Number(listed.body[0].price)).toBe(29.99); // DECIMAL columns can come back as text
});

test('price and image_url are optional', async () => {
  const a = await makeUserWithList('item-optional');
  const res = await save(a, { title: 'Mystery gift', source_url: 'http://shop.test/mystery' });

  expect(res.status).toBe(201);
  expect(res.body.price).toBeNull();
  expect(res.body.image_url).toBeNull();
});

test('the title is trimmed', async () => {
  const a = await makeUserWithList('item-trim');
  const res = await save(a, { ...VALID, title: '  Blue Kettle  ' });

  expect(res.status).toBe(201);
  expect(res.body.title).toBe('Blue Kettle');
});

test('the price limits are accepted: 0 and 99999999.99', async () => {
  const a = await makeUserWithList('item-price-edges');
  expect((await save(a, { ...VALID, price: 0 })).status).toBe(201);
  expect((await save(a, { ...VALID, price: 99999999.99 })).status).toBe(201);
});

const TITLE_MSG = 'Item title is required.';
const SOURCE_MSG = 'source_url must be an http or https link.';
const PRICE_MSG = 'price must be a number from 0 to 99999999.99.';
const IMAGE_MSG = 'image_url must be an http or https link.';

test.each([
  ['a missing title', { ...VALID, title: undefined }, TITLE_MSG],
  ['a blank title', { ...VALID, title: '   ' }, TITLE_MSG],
  ['a title of 256 characters', { ...VALID, title: 'a'.repeat(256) }, 'Item title must be 255 characters or fewer.'],
  ['a missing source_url', { ...VALID, source_url: undefined }, SOURCE_MSG],
  ['a source_url that is not a link', { ...VALID, source_url: 'not a url' }, SOURCE_MSG],
  ['a javascript: source_url', { ...VALID, source_url: 'javascript:alert(1)' }, SOURCE_MSG],
  ['a source_url over 2048 characters', { ...VALID, source_url: `https://shop.test/${'a'.repeat(2048)}` }, SOURCE_MSG],
  ['a price sent as text', { ...VALID, price: '29.99' }, PRICE_MSG],
  ['a negative price', { ...VALID, price: -1 }, PRICE_MSG],
  ['a price over the DECIMAL(10,2) limit', { ...VALID, price: 100000000 }, PRICE_MSG],
  ['a data: image_url', { ...VALID, image_url: 'data:text/html,<b>hi</b>' }, IMAGE_MSG],
])('400 for %s, and nothing is saved', async (_label, body, message) => {
  const a = await makeUserWithList('item-bad');
  const res = await save(a, body);

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: message });
  expect((await items(a)).body).toEqual([]);
});

test('400 when the request has no body at all', async () => {
  const a = await makeUserWithList('item-nobody');
  const res = await request(app)
    .post(`/wishlists/${a.list.wishlist_id}/items`)
    .set('Authorization', a.auth);

  expect(res.status).toBe(400);
});

test("404 for another user's wishlist and for an unknown wishlist, and nothing is saved", async () => {
  const a = await makeUserWithList('item-owner');
  const b = await makeUserWithList('item-intruder');

  const intruder = await save(b, VALID, a.list.wishlist_id);
  const unknown = await save(a, VALID, randomUUID());

  expect(intruder.status).toBe(404);
  expect(unknown.status).toBe(404);
  expect(intruder.body).toEqual({ error: 'Wishlist not found.' });
  expect((await items(a)).body).toEqual([]);
});

test('401 with no token', async () => {
  const a = await makeUserWithList('item-notoken');
  const res = await request(app).post(`/wishlists/${a.list.wishlist_id}/items`).send(VALID);
  expect(res.status).toBe(401);
});