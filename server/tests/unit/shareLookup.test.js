jest.mock('../../src/repositories/wishlistRepository', () => ({
  findOwned: jest.fn(),
  setShareId: jest.fn(),
  findByShareId: jest.fn(),
}));
jest.mock('../../src/repositories/itemRepository', () => ({
  listForShare: jest.fn(),
}));

const wishlistRepo = require('../../src/repositories/wishlistRepository');
const itemRepo = require('../../src/repositories/itemRepository');
const shareService = require('../../src/services/shareService');

beforeEach(() => { jest.clearAllMocks(); });

describe('getSharedWishlist with IDs that can never be real (T-102)', () => {
  test.each([
    ['an empty ID', ''],
    ['an ID that is too short', 'a'.repeat(31)],
    ['an ID that is too long', 'a'.repeat(65)],
    ['an ID with a dash', `${'a'.repeat(31)}-`],
    ['an ID with a space', `${'a'.repeat(31)} `],
    ['a path trick', '../../../etc/passwd'],
    ['a SQL trick', "' OR '1'='1"],
  ])('404 for %s, without a database query', async (_label, shareId) => {
    await expect(shareService.getSharedWishlist(shareId)).rejects.toMatchObject({
      status: 404,
      message: 'Wishlist not found.',
    });
    expect(wishlistRepo.findByShareId).not.toHaveBeenCalled();
    expect(itemRepo.listForShare).not.toHaveBeenCalled();
  });
});

describe('getSharedWishlist with well-formed IDs (T-100)', () => {
  test.each([
    ['32 characters', 'a'.repeat(32)],
    ['64 characters', 'A1'.repeat(32)],
  ])('looks up an ID of %s, and 404s when no wishlist has it', async (_label, shareId) => {
    wishlistRepo.findByShareId.mockResolvedValue(null);

    await expect(shareService.getSharedWishlist(shareId)).rejects.toMatchObject({
      status: 404,
      message: 'Wishlist not found.',
    });
    expect(wishlistRepo.findByShareId).toHaveBeenCalledWith(shareId);
    expect(itemRepo.listForShare).not.toHaveBeenCalled();
  });
});