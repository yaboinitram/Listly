jest.mock('../../src/repositories/wishlistRepository', () => ({
  create: jest.fn(),
  listByOwner: jest.fn(),
  listSummariesByOwner: jest.fn(),
  rename: jest.fn(),
  remove: jest.fn(),
}));

const wishlistRepo = require('../../src/repositories/wishlistRepository');
const wishlistService = require('../../src/services/wishlistService');

const OWNER = 'owner-1';

beforeEach(() => { jest.clearAllMocks(); });

describe('wishlistService.createWishlist (T-36)', () => {
  test('saves the trimmed name for the owner and returns the new wishlist', async () => {
    wishlistRepo.create.mockResolvedValue({ wishlist_id: 'w-1', name: 'Birthday' });

    const result = await wishlistService.createWishlist(OWNER, '  Birthday  ');

    expect(wishlistRepo.create).toHaveBeenCalledWith(OWNER, 'Birthday');
    expect(result).toEqual({ wishlist_id: 'w-1', name: 'Birthday' });
  });

  test('accepts a name of exactly 100 characters', async () => {
    wishlistRepo.create.mockResolvedValue({ wishlist_id: 'w-2', name: 'a'.repeat(100) });
    await expect(wishlistService.createWishlist(OWNER, 'a'.repeat(100))).resolves.toBeDefined();
  });

  test.each([
    ['missing name', undefined],
    ['empty name', ''],
    ['only spaces', '   '],
    ['non-string name', 42],
  ])('400 "name is required" on %s', async (_label, name) => {
    await expect(wishlistService.createWishlist(OWNER, name))
      .rejects.toMatchObject({ status: 400, message: 'Wishlist name is required.' });
    expect(wishlistRepo.create).not.toHaveBeenCalled();
  });

  test('400 with its own message on a 101-character name', async () => {
    await expect(wishlistService.createWishlist(OWNER, 'a'.repeat(101)))
      .rejects.toMatchObject({ status: 400, message: 'Wishlist name must be 100 characters or fewer.' });
    expect(wishlistRepo.create).not.toHaveBeenCalled();
  });
});

describe('wishlistService.listWishlists (T-37)', () => {
  test("returns the owner's wishlists, with share_id and item_count, from the repository", async () => {
    const lists = [{ wishlist_id: 'w-1', name: 'Birthday', share_id: null, item_count: 2 }];
    wishlistRepo.listSummariesByOwner.mockResolvedValue(lists);

    expect(await wishlistService.listWishlists(OWNER)).toEqual(lists);
    expect(wishlistRepo.listSummariesByOwner).toHaveBeenCalledWith(OWNER);
  });
});

describe('wishlistService.renameWishlist', () => {
  test('saves the trimmed name and returns the renamed wishlist', async () => {
    const renamed = { wishlist_id: 'w-1', name: 'Holidays', share_id: null };
    wishlistRepo.rename.mockResolvedValue(renamed);

    expect(await wishlistService.renameWishlist(OWNER, 'w-1', '  Holidays ')).toEqual(renamed);
    expect(wishlistRepo.rename).toHaveBeenCalledWith(OWNER, 'w-1', 'Holidays');
  });

  test.each([
    ['empty name', '', 'Wishlist name is required.'],
    ['101-character name', 'a'.repeat(101), 'Wishlist name must be 100 characters or fewer.'],
  ])('400 on %s, same rules as creating', async (_label, name, message) => {
    await expect(wishlistService.renameWishlist(OWNER, 'w-1', name))
      .rejects.toMatchObject({ status: 400, message });
    expect(wishlistRepo.rename).not.toHaveBeenCalled();
  });

  test("404 when the repository doesn't find an owned wishlist", async () => {
    wishlistRepo.rename.mockResolvedValue(null);
    await expect(wishlistService.renameWishlist(OWNER, 'w-x', 'New'))
      .rejects.toMatchObject({ status: 404, message: 'Wishlist not found.' });
  });
});

describe('wishlistService.deleteWishlist', () => {
  test('deletes an owned wishlist', async () => {
    wishlistRepo.remove.mockResolvedValue(true);
    await expect(wishlistService.deleteWishlist(OWNER, 'w-1')).resolves.toBeUndefined();
    expect(wishlistRepo.remove).toHaveBeenCalledWith(OWNER, 'w-1');
  });

  test("404 when the repository doesn't find an owned wishlist", async () => {
    wishlistRepo.remove.mockResolvedValue(false);
    await expect(wishlistService.deleteWishlist(OWNER, 'w-x'))
      .rejects.toMatchObject({ status: 404, message: 'Wishlist not found.' });
  });
});