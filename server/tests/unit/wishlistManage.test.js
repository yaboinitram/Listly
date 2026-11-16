jest.mock('../../src/repositories/wishlistRepository', () => ({
  listSummariesByOwner: jest.fn(),
  rename: jest.fn(),
  remove: jest.fn(),
}));

const wishlistRepo = require('../../src/repositories/wishlistRepository');
const wishlistService = require('../../src/services/wishlistService');

const OWNER = 'owner-1';
const LIST = 'list-1';

beforeEach(() => { jest.clearAllMocks(); });

describe('wishlistService.listWishlistSummaries (T-114)', () => {
  test("returns the owner's lists with share_id and item_count", async () => {
    const lists = [{ wishlist_id: LIST, name: 'Birthday', share_id: null, item_count: 2 }];
    wishlistRepo.listSummariesByOwner.mockResolvedValue(lists);

    expect(await wishlistService.listWishlistSummaries(OWNER)).toEqual(lists);
    expect(wishlistRepo.listSummariesByOwner).toHaveBeenCalledWith(OWNER);
  });
});

describe('wishlistService.renameWishlist (T-136)', () => {
  test('trims the name and saves it', async () => {
    wishlistRepo.rename.mockResolvedValue({ wishlist_id: LIST, name: 'Holidays' });

    const result = await wishlistService.renameWishlist(OWNER, LIST, '  Holidays  ');

    expect(wishlistRepo.rename).toHaveBeenCalledWith(OWNER, LIST, 'Holidays');
    expect(result).toEqual({ wishlist_id: LIST, name: 'Holidays' });
  });

  test('accepts a name of exactly 100 characters', async () => {
    const name = 'x'.repeat(100);
    wishlistRepo.rename.mockResolvedValue({ wishlist_id: LIST, name });

    await wishlistService.renameWishlist(OWNER, LIST, name);

    expect(wishlistRepo.rename).toHaveBeenCalledWith(OWNER, LIST, name);
  });

  test.each([
    ['a missing name', undefined, 'Wishlist name is required.'],
    ['an empty name', '   ', 'Wishlist name is required.'],
    ['a name that is not text', 42, 'Wishlist name is required.'],
    ['a name over 100 characters', 'x'.repeat(101), 'Wishlist name must be 100 characters or fewer.'],
  ])('400 for %s, and nothing is saved', async (_label, name, message) => {
    await expect(wishlistService.renameWishlist(OWNER, LIST, name)).rejects.toMatchObject({ status: 400, message });
    expect(wishlistRepo.rename).not.toHaveBeenCalled();
  });

  test("404 when the user doesn't own the wishlist", async () => {
    wishlistRepo.rename.mockResolvedValue(null);

    await expect(wishlistService.renameWishlist(OWNER, LIST, 'Holidays')).rejects.toMatchObject({
      status: 404,
      message: 'Wishlist not found.',
    });
  });
});

describe('wishlistService.deleteWishlist (T-137)', () => {
  test('deletes the wishlist for its owner', async () => {
    wishlistRepo.remove.mockResolvedValue(true);

    await expect(wishlistService.deleteWishlist(OWNER, LIST)).resolves.toBeUndefined();
    expect(wishlistRepo.remove).toHaveBeenCalledWith(OWNER, LIST);
  });

  test("404 when the user doesn't own the wishlist", async () => {
    wishlistRepo.remove.mockResolvedValue(false);

    await expect(wishlistService.deleteWishlist(OWNER, LIST)).rejects.toMatchObject({
      status: 404,
      message: 'Wishlist not found.',
    });
  });
});