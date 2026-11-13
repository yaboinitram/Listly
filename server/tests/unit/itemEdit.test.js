jest.mock('../../src/repositories/itemRepository', () => ({
  update: jest.fn(),
  remove: jest.fn(),
}));

const itemRepo = require('../../src/repositories/itemRepository');
const itemService = require('../../src/services/itemService');

const OWNER = 'owner-1';
const LIST = 'list-1';
const ITEM = 'item-1';
const VALID = {
  title: 'Red Kettle',
  price: 24.5,
  image_url: 'https://shop.test/red.jpg',
  source_url: 'https://shop.test/red-kettle',
};

beforeEach(() => { jest.clearAllMocks(); });

describe('itemService.updateItem (T-73)', () => {
  test('passes the owner, wishlist, item, and checked fields to the repository', async () => {
    const updated = { item_id: ITEM, wishlist_id: LIST, title: 'Red Kettle' };
    itemRepo.update.mockResolvedValue(updated);

    const result = await itemService.updateItem(OWNER, LIST, ITEM, { ...VALID, title: '  Red Kettle  ' });

    expect(itemRepo.update).toHaveBeenCalledWith(OWNER, LIST, ITEM, {
      title: 'Red Kettle',
      price: 24.5,
      imageUrl: VALID.image_url,
      sourceUrl: VALID.source_url,
    });
    expect(result).toBe(updated);
  });

  test('a field left out of the body is cleared to null', async () => {
    itemRepo.update.mockResolvedValue({ item_id: ITEM });

    await itemService.updateItem(OWNER, LIST, ITEM, { title: 'Red Kettle', source_url: VALID.source_url });

    expect(itemRepo.update).toHaveBeenCalledWith(
      OWNER, LIST, ITEM, expect.objectContaining({ price: null, imageUrl: null })
    );
  });

  test.each([
    ['an empty title', { ...VALID, title: '   ' }, 'Item title is required.'],
    ['a title over 255 characters', { ...VALID, title: 'x'.repeat(256) }, 'Item title must be 255 characters or fewer.'],
    ['a javascript: link', { ...VALID, source_url: 'javascript:alert(1)' }, 'source_url must be an http or https link.'],
    ['a negative price', { ...VALID, price: -1 }, 'price must be a number from 0 to 99999999.99.'],
    ['a price sent as text', { ...VALID, price: '24.50' }, 'price must be a number from 0 to 99999999.99.'],
    ['a bad image link', { ...VALID, image_url: 'ftp://shop.test/red.jpg' }, 'image_url must be an http or https link.'],
    ['no body at all', undefined, 'Item title is required.'],
  ])('400 for %s, and nothing is saved', async (_label, body, message) => {
    await expect(itemService.updateItem(OWNER, LIST, ITEM, body)).rejects.toMatchObject({ status: 400, message });
    expect(itemRepo.update).not.toHaveBeenCalled();
  });

  test("404 when the item isn't in a wishlist the user owns", async () => {
    itemRepo.update.mockResolvedValue(null);

    await expect(itemService.updateItem(OWNER, LIST, ITEM, VALID)).rejects.toMatchObject({
      status: 404,
      message: 'Item not found.',
    });
  });
});

describe('itemService.removeItem (T-74)', () => {
  test("deletes the item for its wishlist's owner", async () => {
    itemRepo.remove.mockResolvedValue(true);

    await expect(itemService.removeItem(OWNER, LIST, ITEM)).resolves.toBeUndefined();
    expect(itemRepo.remove).toHaveBeenCalledWith(OWNER, LIST, ITEM);
  });

  test("404 when the item isn't in a wishlist the user owns", async () => {
    itemRepo.remove.mockResolvedValue(false);

    await expect(itemService.removeItem(OWNER, LIST, ITEM)).rejects.toMatchObject({
      status: 404,
      message: 'Item not found.',
    });
  });
});
