jest.mock('../../src/repositories/itemRepository', () => ({
  insert: jest.fn(),
  listForOwnedWishlist: jest.fn(),
}));

const itemRepo = require('../../src/repositories/itemRepository');
const itemService = require('../../src/services/itemService');

const OWNER = 'owner-1';
const LIST = 'list-1';
const VALID = {
  title: 'Blue Kettle',
  price: 29.99,
  image_url: 'https://shop.test/kettle.jpg',
  source_url: 'https://shop.test/kettle',
};
const PRICE_MSG = 'price must be a number from 0 to 99999999.99.';
const SOURCE_MSG = 'source_url must be an http or https link.';

beforeEach(() => { jest.clearAllMocks(); });

describe('itemService.addItem (T-46)', () => {
  test('passes the repository a trimmed title and camelCase fields', async () => {
    const saved = { item_id: 'i-1', wishlist_id: LIST, title: 'Blue Kettle' };
    itemRepo.insert.mockResolvedValue(saved);

    const result = await itemService.addItem(OWNER, LIST, { ...VALID, title: '  Blue Kettle  ' });

    expect(itemRepo.insert).toHaveBeenCalledWith(OWNER, LIST, {
      title: 'Blue Kettle',
      price: 29.99,
      imageUrl: VALID.image_url,
      sourceUrl: VALID.source_url,
    });
    expect(result).toEqual(saved);
  });

  test('price and image_url are optional and saved as null', async () => {
    itemRepo.insert.mockResolvedValue({ item_id: 'i-2' });
    await itemService.addItem(OWNER, LIST, { title: 'Mystery gift', source_url: 'http://shop.test/m' });

    expect(itemRepo.insert).toHaveBeenCalledWith(OWNER, LIST, {
      title: 'Mystery gift',
      price: null,
      imageUrl: null,
      sourceUrl: 'http://shop.test/m',
    });
  });

  test.each([
    ['no body at all', undefined, 'Item title is required.'],
    ['missing title', { ...VALID, title: undefined }, 'Item title is required.'],
    ['blank title', { ...VALID, title: '   ' }, 'Item title is required.'],
    ['title over 255 characters', { ...VALID, title: 'a'.repeat(256) }, 'Item title must be 255 characters or fewer.'],
    ['missing source_url', { ...VALID, source_url: undefined }, SOURCE_MSG],
    ['source_url that is not a link', { ...VALID, source_url: 'not a url' }, SOURCE_MSG],
    ['javascript: source_url', { ...VALID, source_url: 'javascript:alert(1)' }, SOURCE_MSG],
    ['price sent as text', { ...VALID, price: '29.99' }, PRICE_MSG],
    ['negative price', { ...VALID, price: -1 }, PRICE_MSG],
    ['price too big for DECIMAL(10,2)', { ...VALID, price: 100000000 }, PRICE_MSG],
    ['data: image_url', { ...VALID, image_url: 'data:text/html,<b>hi</b>' }, 'image_url must be an http or https link.'],
  ])('400 on %s', async (_label, body, message) => {
    await expect(itemService.addItem(OWNER, LIST, body)).rejects.toMatchObject({ status: 400, message });
    expect(itemRepo.insert).not.toHaveBeenCalled();
  });

  test("404 when the wishlist isn't the user's (T-42)", async () => {
    itemRepo.insert.mockResolvedValue(null); // the repository's "not yours or not found"
    await expect(itemService.addItem(OWNER, LIST, VALID))
      .rejects.toMatchObject({ status: 404, message: 'Wishlist not found.' });
  });
});

describe('itemService.listItems (T-46)', () => {
  test('returns the items, including an empty list', async () => {
    itemRepo.listForOwnedWishlist.mockResolvedValue([]);

    expect(await itemService.listItems(OWNER, LIST)).toEqual([]);
    expect(itemRepo.listForOwnedWishlist).toHaveBeenCalledWith(OWNER, LIST);
  });

  test("404 when the wishlist isn't the user's (T-42)", async () => {
    itemRepo.listForOwnedWishlist.mockResolvedValue(null);
    await expect(itemService.listItems(OWNER, LIST)).rejects.toMatchObject({ status: 404 });
  });
});