// Checks for the "save item" form (T-64). Plain functions with no React or browser APIs,
// so they can be tested on their own and reused anywhere an item is saved.

export const MAX_TITLE_LENGTH = 255; // items.title is VARCHAR(255) on the server
export const MAX_PRICE = 99999999.99; // items.price is DECIMAL(10,2) on the server

export const TITLE_REQUIRED = 'Give this item a name.';
export const TITLE_TOO_LONG = `Item name must be ${MAX_TITLE_LENGTH} characters or fewer.`;
export const PRICE_INVALID = 'Price should be a number, like 24.99.';

// Digits with an optional $ in front, optional 1,234 style commas, and up to 2 decimals.
// "abc", "12abc", "-5", "1.2.3" and "12.999" don't match.
const PRICE_PATTERN = /^\$?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;

/**
 * Turns what the user typed into a number.
 * An empty box is fine (the price is optional) and gives { ok: true, value: null }.
 * @returns {{ ok: true, value: number | null } | { ok: false, error: string }}
 */
export function parsePrice(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!PRICE_PATTERN.test(trimmed)) return { ok: false, error: PRICE_INVALID };

  const value = Number(trimmed.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(value) || value < 0 || value > MAX_PRICE) {
    return { ok: false, error: PRICE_INVALID };
  }
  return { ok: true, value };
}

/**
 * Checks the title and price before an item is saved: the title is required and the price,
 * if there is one, must be a number.
 * @returns {{ ok: true, item: { title: string, price: number | null } } | { ok: false, error: string }}
 */
export function validateItemForm({ title, price }) {
  const cleanTitle = String(title ?? '').trim();
  if (!cleanTitle) return { ok: false, error: TITLE_REQUIRED };
  if (cleanTitle.length > MAX_TITLE_LENGTH) return { ok: false, error: TITLE_TOO_LONG };

  const parsed = parsePrice(price);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  return { ok: true, item: { title: cleanTitle, price: parsed.value } };
}