const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db');
const { makeUser } = require('../helpers/makeUser');

afterAll(async () => { await pool.end(); });

const as = (user) => ({
  get: (url) => request(app).get(url).set('Authorization', user.auth),
  post: (url, body) => request(app).post(url).set('Authorization', user.auth).send(body),
  patch: (url, body) => request(app).patch(url).set('Authorization', user.auth).send(body),
  del: (url) => request(app).delete(url).set('Authorization', user.auth),
});

const ITEM = { title: 'Blue Kettle', price: 29.99, source_url: 'https://shop.test/kettle' };

async function userWithList(tag, name = 'Birthday') {
  const user = await makeUser(tag);
  const list = (await as(user).post('/wishlists', { name })).body;
  return { user, list, api: as(user) };
}

describe('GET /wishlists includes share_id and item_count', () => {
  test('a new list: not shared, no items', async () => {
    const { list, api } = await userWithList('summary-new');
    const res = await api.get('/wishlists');
    expect(res.body).toEqual([{ wishlist_id: list.wishlist_id, name: 'Birthday', share_id: null, item_count: 0 }]);
  });

  test('after adding items and sharing', async () => {
    const { list, api } = await userWithList('summary-shared');
    await api.post(`/wishlists/${list.wishlist_id}/items`, ITEM);
    await api.post(`/wishlists/${list.wishlist_id}/items`, ITEM);
    const { share_id: shareId } = (await api.post(`/wishlists/${list.wishlist_id}/share`)).body;

    const [summary] = (await api.get('/wishlists')).body;
    expect(summary).toEqual({ wishlist_id: list.wishlist_id, name: 'Birthday', share_id: shareId, item_count: 2 });
  });

  test("counts each list's own items only", async () => {
    const { user, list: a, api } = await userWithList('summary-two', 'A');
    await as(user).post('/wishlists', { name: 'B' });
    await api.post(`/wishlists/${a.wishlist_id}/items`, ITEM);

    const counts = (await api.get('/wishlists')).body.map((w) => [w.name, w.item_count]);
    expect(counts).toEqual([['A', 1], ['B', 0]]);
  });
});

describe('PATCH /wishlists/:wishlistId renames', () => {
  test('200 with the new name, and the list shows it', async () => {
    const { list, api } = await userWithList('rename');
    const res = await api.patch(`/wishlists/${list.wishlist_id}`, { name: '  Holidays  ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ wishlist_id: list.wishlist_id, name: 'Holidays' });
    expect((await api.get('/wishlists')).body[0].name).toBe('Holidays');
  });

  test('renaming to the same name is still 200', async () => {
    const { list, api } = await userWithList('rename-same');
    expect((await api.patch(`/wishlists/${list.wishlist_id}`, { name: 'Birthday' })).status).toBe(200);
  });

  test('a shared list keeps its link after a rename, and the link shows the new name', async () => {
    const { list, api } = await userWithList('rename-shared');
    const { share_id: shareId } = (await api.post(`/wishlists/${list.wishlist_id}/share`)).body;
    await api.patch(`/wishlists/${list.wishlist_id}`, { name: 'Renamed' });

    const shared = await request(app).get(`/share/${shareId}`);
    expect(shared.body.name).toBe('Renamed');
  });

  test.each([
    [{}, 'Wishlist name is required.'],
    [{ name: '   ' }, 'Wishlist name is required.'],
    [{ name: 'a'.repeat(101) }, 'Wishlist name must be 100 characters or fewer.'],
  ])('400 on %j, and the name is unchanged', async (body, error) => {
    const { list, api } = await userWithList('rename-bad');
    const res = await api.patch(`/wishlists/${list.wishlist_id}`, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect((await api.get('/wishlists')).body[0].name).toBe('Birthday');
  });

  test("404 for someone else's list, which keeps its name", async () => {
    const { list, api: owner } = await userWithList('rename-owner');
    const stranger = as(await makeUser('rename-stranger'));

    const res = await stranger.patch(`/wishlists/${list.wishlist_id}`, { name: 'Hacked' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Wishlist not found.' });
    expect((await owner.get('/wishlists')).body[0].name).toBe('Birthday');
  });

  test('401 without a token', async () => {
    const { list } = await userWithList('rename-anon');
    expect((await request(app).patch(`/wishlists/${list.wishlist_id}`).send({ name: 'x' })).status).toBe(401);
  });
});

describe('DELETE /wishlists/:wishlistId', () => {
  test('204, and the list and its items are gone', async () => {
    const { list, api } = await userWithList('delete');
    await api.post(`/wishlists/${list.wishlist_id}/items`, ITEM);

    expect((await api.del(`/wishlists/${list.wishlist_id}`)).status).toBe(204);
    expect((await api.get('/wishlists')).body).toEqual([]);

    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM items WHERE wishlist_id = ?', [list.wishlist_id]);
    expect(rows[0].n).toBe(0);
  });

  test('its share link stops working', async () => {
    const { list, api } = await userWithList('delete-shared');
    const { share_id: shareId } = (await api.post(`/wishlists/${list.wishlist_id}/share`)).body;
    await api.del(`/wishlists/${list.wishlist_id}`);

    expect((await request(app).get(`/share/${shareId}`)).status).toBe(404);
  });

  test('deleting it again is 404', async () => {
    const { list, api } = await userWithList('delete-twice');
    await api.del(`/wishlists/${list.wishlist_id}`);
    expect((await api.del(`/wishlists/${list.wishlist_id}`)).status).toBe(404);
  });

  test("404 for someone else's list, which survives", async () => {
    const { list, api: owner } = await userWithList('delete-owner');
    const stranger = as(await makeUser('delete-stranger'));

    expect((await stranger.del(`/wishlists/${list.wishlist_id}`)).status).toBe(404);
    expect((await owner.get('/wishlists')).body).toHaveLength(1);
  });

  test('401 without a token', async () => {
    const { list } = await userWithList('delete-anon');
    expect((await request(app).delete(`/wishlists/${list.wishlist_id}`)).status).toBe(401);
  });
});
