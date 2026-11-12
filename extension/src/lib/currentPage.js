import { scrapeProduct } from './scrapeProduct';
import { IN_EXTENSION } from './config';

// Shown when previewing the popup with `npm run dev` in a normal browser tab,
// where Chrome's extension APIs don't exist.
const DEV_SAMPLE = {
  title: 'Linen Throw Blanket, Oat',
  price: 64,
  currency: 'USD',
  image_url: null,
  source_url: 'https://www.example-store.com/products/linen-throw',
  looksLikeProduct: true,
  isSample: true,
};

/**
 * Reads product details from the active tab.
 * Always resolves to one of:
 *   { status: 'ok', ...product }   – the page was read (price may still be null)
 *   { status: 'unsupported' }      – a tab extensions can't use (new tab, chrome://, settings)
 *   { status: 'blocked', title, source_url, reason } – Chrome refused to run the script
 */
export async function readCurrentPage() {
  if (!IN_EXTENSION) return { status: 'ok', ...DEV_SAMPLE };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) return { status: 'unsupported' };

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeProduct,
    });
    console.log('[Listly] read page:', injection?.result);
    if (!injection?.result) throw new Error('The page returned no result.');
    return { status: 'ok', ...injection.result };
  } catch (err) {
    // Shows up when you right-click the popup -> Inspect -> Console
    console.error('[Listly] could not read page:', err);
    return {
      status: 'blocked',
      title: tab.title || '',
      price: null,
      image_url: null,
      source_url: tab.url,
      looksLikeProduct: false,
      reason: err?.message || String(err),
    };
  }
}
