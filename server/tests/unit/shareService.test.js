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

const OWNER = 'owner-1';
const LIST = 'list-1';
const ID_A = 'a'.repeat(32);
const ID_B = 'b'.repeat(32);
const NOT_SHARED = { wishlist_id: LIST, name: 'Gifts', share_id: null };

// The error mysql2 throws when the unique index on share_id rejects a duplicate.
function duplicateError() {
  const err = new Error("Duplicate entry for key 'uq_wishlists_share_id'");
  err.code = 'ER_DUP_ENTRY';
  return err;
}

beforeEach(() => { jest.clearAllMocks(); });

describe('shareService.createShareLink (T-80)', () => {
  test('saves a new share ID for the owner', async () => {
    wishlistRepo.findOwned.mockResolvedValue(NOT_SHARED);
    wishlistRepo.setShareId.mockResolvedValue(true);

    const result = await shareService.createShareLink(OWNER, LIST, () => ID_A);

    expect(wishlistRepo.setShareId).toHaveBeenCalledWith(OWNER, LIST, ID_A);
    expect(result).toEqual({ share_id: ID_A, created: true });
  });

  test('uses the real generator when none is passed (T-79)', async () => {
    wishlistRepo.findOwned.mockResolvedValue(NOT_SHARED);
    wishlistRepo.setShareId.mockResolvedValue(true);

    const result = await shareService.createShareLink(OWNER, LIST);

    expect(result.share_id).toMatch(/^[A-Za-z0-9]{32,}$/);
  });

  test('returns the existing link when the wishlist is already shared', async () => {
    wishlistRepo.findOwned.mockResolvedValue({ ...NOT_SHARED, share_id: ID_A });

    const result = await shareService.createShareLink(OWNER, LIST, () => ID_B);

    expect(result).toEqual({ share_id: ID_A, created: false });
    expect(wishlistRepo.setShareId).not.toHaveBeenCalled();
  });

  test("404 when the user doesn't own the wishlist", async () => {
    wishlistRepo.findOwned.mockResolvedValue(null);

    await expect(shareService.createShareLink(OWNER, LIST)).rejects.toMatchObject({
      status: 404,
      message: 'Wishlist not found.',
    });
    expect(wishlistRepo.setShareId).not.toHaveBeenCalled();
  });

  test('tries a new ID when the first one collides', async () => {
    wishlistRepo.findOwned.mockResolvedValue(NOT_SHARED);
    wishlistRepo.setShareId.mockRejectedValueOnce(duplicateError()).mockResolvedValueOnce(true);
    const generate = jest.fn().mockReturnValueOnce(ID_A).mockReturnValueOnce(ID_B);

    const result = await shareService.createShareLink(OWNER, LIST, generate);

    expect(wishlistRepo.setShareId).toHaveBeenNthCalledWith(1, OWNER, LIST, ID_A);
    expect(wishlistRepo.setShareId).toHaveBeenNthCalledWith(2, OWNER, LIST, ID_B);
    expect(result).toEqual({ share_id: ID_B, created: true });
  });

  test('gives up with 500 after 5 collisions in a row', async () => {
    wishlistRepo.findOwned.mockResolvedValue(NOT_SHARED);
    wishlistRepo.setShareId.mockRejectedValue(duplicateError());

    await expect(shareService.createShareLink(OWNER, LIST, () => ID_A)).rejects.toMatchObject({ status: 500 });
    expect(wishlistRepo.setShareId).toHaveBeenCalledTimes(5);
  });

  test('does not retry other database errors', async () => {
    const dbDown = new Error('connect ECONNREFUSED');
    dbDown.code = 'ECONNREFUSED';
    wishlistRepo.findOwned.mockResolvedValue(NOT_SHARED);
    wishlistRepo.setShareId.mockRejectedValue(dbDown);

    await expect(shareService.createShareLink(OWNER, LIST, () => ID_A)).rejects.toBe(dbDown);
    expect(wishlistRepo.setShareId).toHaveBeenCalledTimes(1);
  });

  test('returns the link that another request saved a moment earlier', async () => {
    wishlistRepo.findOwned
      .mockResolvedValueOnce(NOT_SHARED)
      .mockResolvedValueOnce({ ...NOT_SHARED, share_id: ID_A });
    wishlistRepo.setShareId.mockResolvedValue(false);

    const result = await shareService.createShareLink(OWNER, LIST, () => ID_B);

    expect(result).toEqual({ share_id: ID_A, created: false });
  });
});

describe('shareService.getSharedWishlist (T-85, T-90)', () => {
  test('returns only the wishlist name and its items', async () => {
    const items = [{ title: 'Blue Kettle', price: '29.99', image_url: null, source_url: 'https://shop.test/kettle' }];
    wishlistRepo.findByShareId.mockResolvedValue({ wishlist_id: LIST, name: 'Gifts' });
    itemRepo.listForShare.mockResolvedValue(items);

    const result = await shareService.getSharedWishlist(ID_A);

    expect(wishlistRepo.findByShareId).toHaveBeenCalledWith(ID_A);
    expect(itemRepo.listForShare).toHaveBeenCalledWith(LIST);
    expect(Object.keys(result)).toEqual(['name', 'items']);
    expect(result).toEqual({ name: 'Gifts', items });
  });

  test('404 for an unknown share ID, without reading any items', async () => {
    wishlistRepo.findByShareId.mockResolvedValue(null);

    await expect(shareService.getSharedWishlist(ID_B)).rejects.toMatchObject({
      status: 404,
      message: 'Wishlist not found.',
    });
    expect(itemRepo.listForShare).not.toHaveBeenCalled();
  });
});