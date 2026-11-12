/**
 * Runs INSIDE the shopping page via chrome.scripting.executeScript, so it must be
 * fully self-contained: no imports and no references to anything outside this function.
 *
 * Looks for product details in this order:
 *   1. schema.org JSON-LD (searched recursively; Product or ProductGroup)
 *   2. Open Graph / product meta tags
 *   3. Microdata (itemprop="price")
 *   4. Last resort: first "$12.34" inside an element whose class or id mentions "price"
 *
 * To debug a site: paste this function into that page's DevTools console and run scrapeProduct().
 */
export function scrapeProduct() {
  const meta = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || null;

  const toNumber = (value) => {
    if (value == null) return null;
    let s = String(value).replace(/[^\d.,]/g, '');
    s = s.replace(/[.,](?=\d{3}(\D|$))/g, ''); // drop thousands separators: 1,299.99 -> 1299.99
    s = s.replace(',', '.'); // decimal comma: 12,99 -> 12.99
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  };

  const isProduct = (node) => {
    const types = [].concat(node['@type'] || []);
    return types.includes('Product') || types.includes('ProductGroup');
  };

  const firstOf = (value) => (Array.isArray(value) ? value[0] : value);

  const offerInfo = (offers) => {
    const offer = firstOf(offers);
    if (!offer || typeof offer !== 'object') return { price: null, currency: null };
    const spec = firstOf(offer.priceSpecification);
    return {
      price: toNumber(offer.price ?? offer.lowPrice ?? spec?.price),
      currency: offer.priceCurrency || spec?.priceCurrency || null,
    };
  };

  // Depth-first search of a JSON-LD tree for the first Product that has a price.
  // Also remembers the first Product seen at all, so we can use its name/image.
  const findProduct = (root) => {
    let firstProduct = null;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
        continue;
      }
      if (isProduct(node)) {
        firstProduct ||= node;
        const { price, currency } = offerInfo(node.offers);
        if (price != null) return { product: firstProduct, price, currency };
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') stack.push(value);
      }
    }
    return firstProduct ? { product: firstProduct, price: null, currency: null } : null;
  };

  let title = null;
  let price = null;
  let currency = null;
  let image = null;
  let foundStructuredData = false;

  // 1. JSON-LD
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const found = findProduct(JSON.parse(script.textContent));
      if (!found) continue;
      foundStructuredData = true;
      title ||= found.product.name || null;
      const img = firstOf(found.product.image);
      image ||= typeof img === 'string' ? img : img?.url || null;
      if (found.price != null) {
        price = found.price;
        currency = found.currency;
        break;
      }
    } catch {
      /* malformed JSON-LD; keep looking */
    }
  }

  // 2. Meta tags
  price ??= toNumber(meta('meta[property="product:price:amount"]') || meta('meta[property="og:price:amount"]'));
  currency ||= meta('meta[property="product:price:currency"]') || meta('meta[property="og:price:currency"]');

  // 3. Microdata
  if (price == null) {
    const el = document.querySelector('[itemprop="price"]');
    price = toNumber(el?.getAttribute('content') || el?.textContent);
    currency ||= document.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content') || null;
  }

  // 4. Visible price text. A guess, so the popup asks the user to check it.
  //    Skips crossed-out / "compare at" / list prices so sale pages give the sale price.
  const OLD_PRICE =
    's, del, strike, [class*="strike" i], [class*="compare" i], [class*="was-price" i], ' +
    '[class*="original" i], [class*="list-price" i], [class*="listprice" i]';
  // Text inside el that a shopper would read as the current price: skips crossed-out
  // prices and anything hidden with display:none (themes often keep the old price in the page, hidden).
  const currentPriceText = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent.closest(OLD_PRICE)) continue;
      if (parent.checkVisibility && !parent.checkVisibility()) continue;
      text += node.textContent + ' ';
    }
    return text;
  };

  let priceIsGuess = false;
  if (price == null) {
    for (const el of document.querySelectorAll('[class*="price" i], [id*="price" i]')) {
      if (el.closest(OLD_PRICE)) continue;
      const match = currentPriceText(el).match(/\$\s?(\d[\d,]*(?:\.\d{2})?)/);
      if (match) {
        price = toNumber(match[1]);
        priceIsGuess = price != null;
        if (priceIsGuess) break;
      }
    }
  }

  title ||=
    meta('meta[property="og:title"]') ||
    document.querySelector('h1')?.textContent?.trim() ||
    document.title;
  image ||= meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');

  if (image) {
    try {
      image = new URL(image, location.href).href;
    } catch {
      image = null;
    }
  }

  return {
    title: (title || '').replace(/\s+/g, ' ').trim().slice(0, 255),
    price,
    priceIsGuess,
    currency,
    image_url: image,
    source_url: location.href,
    looksLikeProduct: foundStructuredData || price != null,
  };
}
