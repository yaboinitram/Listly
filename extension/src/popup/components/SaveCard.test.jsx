import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// SaveCard remembers the last list in chrome.storage, which doesn't exist in tests.
vi.mock('../../lib/storage', () => ({
  getLastWishlistId: vi.fn().mockResolvedValue('w1'),
  setLastWishlistId: vi.fn().mockResolvedValue(undefined),
}));

import SaveCard from './SaveCard';

const LISTS = [{ wishlist_id: 'w1', name: 'Gifts' }];

// What readCurrentPage() gives the card.
const COMPLETE_PAGE = {
  status: 'ok',
  title: 'Blue Kettle',
  price: 29.99,
  image_url: null,
  source_url: 'https://shop.test/kettle',
  looksLikeProduct: true,
};
const NO_PRICE_PAGE = { ...COMPLETE_PAGE, price: null };
const NO_TITLE_PAGE = { ...COMPLETE_PAGE, title: '', price: null };

const savedList = { wishlist_id: 'w1', name: 'Gifts' };

// Renders the card and waits until the list picker has chosen 'Gifts'.
async function setup(page, onSave = vi.fn().mockResolvedValue(savedList)) {
  const user = userEvent.setup();
  render(<SaveCard page={page} wishlists={LISTS} onSave={onSave} onOpenList={vi.fn()} />);
  await screen.findByDisplayValue('Gifts');
  return {
    user,
    onSave,
    title: screen.getByLabelText('Item name'),
    price: screen.getByPlaceholderText('Price'),
    save: screen.getByRole('button', { name: 'Save' }),
  };
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('incomplete extraction opens a pre-filled form (T-67)', () => {
  test('a page with a title but no price fills in the title and leaves the price empty', async () => {
    const { title, price } = await setup(NO_PRICE_PAGE);

    expect(title.value).toBe('Blue Kettle');
    expect(price.value).toBe('');
    expect(screen.getByText(/No price found on this page/)).toBeTruthy();
  });

  test('a complete page fills in both fields', async () => {
    const { title, price } = await setup(COMPLETE_PAGE);

    expect(title.value).toBe('Blue Kettle');
    expect(price.value).toBe('29.99');
  });

  test('a page with nothing found still opens the form, with both fields empty', async () => {
    const { title, price } = await setup(NO_TITLE_PAGE);

    expect(title.value).toBe('');
    expect(price.value).toBe('');
  });
});

describe('a non-numeric price is blocked (T-64, T-67)', () => {
  test.each([['abc'], ['12abc'], ['-5'], ['1.2.3']])('"%s" shows an error and nothing is saved', async (bad) => {
    const { user, onSave, price, save } = await setup(NO_PRICE_PAGE);

    await user.type(price, bad);
    await user.click(save);

    expect(screen.getByRole('alert').textContent).toBe('Price should be a number, like 24.99.');
    expect(onSave).not.toHaveBeenCalled();
  });

  test('a blank title shows an error and nothing is saved', async () => {
    const { user, onSave, save } = await setup(NO_TITLE_PAGE);

    await user.click(save);

    expect(screen.getByRole('alert').textContent).toBe('Give this item a name.');
    expect(onSave).not.toHaveBeenCalled();
  });

  test('fixing the price lets the save go through', async () => {
    const { user, onSave, price, save } = await setup(NO_PRICE_PAGE);

    await user.type(price, 'abc');
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(price);
    await user.type(price, '24.99');
    await user.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].item).toMatchObject({ title: 'Blue Kettle', price: 24.99 });
  });

  test('a page with no price can still be saved, with a null price', async () => {
    const { user, onSave, save } = await setup(NO_PRICE_PAGE);

    await user.click(save);

    expect(onSave.mock.calls[0][0].item).toMatchObject({ title: 'Blue Kettle', price: null });
  });
});

describe('a message shows after saving (T-66)', () => {
  test('success: says which list the item was saved to', async () => {
    const { user, save } = await setup(COMPLETE_PAGE);

    await user.click(save);

    expect(await screen.findByText('Saved to Gifts')).toBeTruthy();
  });

  test("error: shows the server's message and keeps the form so the user can try again", async () => {
    const failing = vi.fn().mockRejectedValue(new Error('Could not reach the Listly server.'));
    const { user, title, save } = await setup(COMPLETE_PAGE, failing);

    await user.click(save);

    expect((await screen.findByRole('alert')).textContent).toBe('Could not reach the Listly server.');
    expect(title.value).toBe('Blue Kettle');
    expect(screen.queryByText(/Saved to/)).toBeNull();
  });
});
