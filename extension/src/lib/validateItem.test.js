import { describe, expect, test } from 'vitest';
import { parsePrice, validateItemForm, TITLE_REQUIRED, TITLE_TOO_LONG, PRICE_INVALID } from './validateItem';

describe('parsePrice (T-64)', () => {
  test.each([
    ['24.99', 24.99],
    ['24', 24],
    ['0', 0],
    ['0.5', 0.5],
    ['$24.99', 24.99],
    ['$ 24.99', 24.99],
    ['  24.99  ', 24.99],
    ['1,299.99', 1299.99],
    ['1299.00', 1299],
    ['99999999.99', 99999999.99],
  ])('accepts %s as %s', (text, expected) => {
    expect(parsePrice(text)).toEqual({ ok: true, value: expected });
  });

  test.each([[''], ['   '], [null], [undefined]])('an empty price (%s) is allowed and becomes null', (text) => {
    expect(parsePrice(text)).toEqual({ ok: true, value: null });
  });

  test.each([
    ['abc'],
    ['12abc'],
    ['abc12'],
    ['$'],
    ['-5'],
    ['1.2.3'],
    ['12.999'],
    ['1,29.99'],
    ['24,99'],
    ['NaN'],
    ['Infinity'],
    ['1e3'],
    ['100000000'],
  ])('blocks %s', (text) => {
    expect(parsePrice(text)).toEqual({ ok: false, error: PRICE_INVALID });
  });
});

describe('validateItemForm (T-64)', () => {
  test('a title and a numeric price pass, and the title is trimmed', () => {
    expect(validateItemForm({ title: '  Blue Kettle  ', price: '29.99' })).toEqual({
      ok: true,
      item: { title: 'Blue Kettle', price: 29.99 },
    });
  });

  test('the price is optional', () => {
    expect(validateItemForm({ title: 'Mystery gift', price: '' })).toEqual({
      ok: true,
      item: { title: 'Mystery gift', price: null },
    });
  });

  test.each([[''], ['   '], [undefined], [null]])('a missing title (%s) is blocked', (title) => {
    expect(validateItemForm({ title, price: '10' })).toEqual({ ok: false, error: TITLE_REQUIRED });
  });

  test('a title over 255 characters is blocked, and exactly 255 is fine', () => {
    expect(validateItemForm({ title: 'a'.repeat(256), price: '' })).toEqual({ ok: false, error: TITLE_TOO_LONG });
    expect(validateItemForm({ title: 'a'.repeat(255), price: '' }).ok).toBe(true);
  });

  test('a non-numeric price is blocked even when the title is fine', () => {
    expect(validateItemForm({ title: 'Blue Kettle', price: 'abc' })).toEqual({ ok: false, error: PRICE_INVALID });
  });

  test('the title is checked before the price', () => {
    expect(validateItemForm({ title: '', price: 'abc' })).toEqual({ ok: false, error: TITLE_REQUIRED });
  });
});