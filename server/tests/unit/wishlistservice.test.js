jest.mock('../../src/repositories/wishlistRepository', () => ({
  create: jest.fn(),
  listByOwner: jest.fn(),
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
  test("returns the owner's wishlists from the repository", async () => {
    const lists = [{ wishlist_id: 'w-1', name: 'Birthday' }];
    wishlistRepo.listByOwner.mockResolvedValue(lists);

    expect(await wishlistService.listWishlists(OWNER)).toEqual(lists);
    expect(wishlistRepo.listByOwner).toHaveBeenCalledWith(OWNER);
  });
});