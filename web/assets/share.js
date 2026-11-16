// Public share page: /s/<share_id>
// Reads the list from GET /share/<share_id> and draws it. No sign-in needed.

const GIFT_ICON =
  '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/>' +
  '<path d="M12 8v13M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7"/>' +
  '<path d="M7.5 8a2.5 2.5 0 010-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 010 5"/></svg>';

const $ = (id) => document.getElementById(id);

function formatPrice(price) {
  if (price == null || price === '') return '';
  const n = Number(price);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
}

function storeName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Only open links that are real web addresses (the server checks this too).
function safeWebUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function placeholder(thumb) {
  thumb.classList.add('item__thumb--empty');
  thumb.innerHTML = GIFT_ICON; // fixed markup above, never data from the list
}

function renderItem(item) {
  const node = $('item-template').content.firstElementChild.cloneNode(true);
  const link = node.querySelector('.item__link');
  const href = safeWebUrl(item.source_url);
  if (href) {
    link.href = href;
  } else {
    link.removeAttribute('target');
    link.classList.add('item__link--static');
  }

  const thumb = node.querySelector('.item__thumb');
  const imageUrl = safeWebUrl(item.image_url);
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      img.remove();
      placeholder(thumb);
    });
    thumb.append(img);
  } else {
    placeholder(thumb);
  }

  node.querySelector('.item__title').textContent = item.title;
  const store = storeName(item.source_url);
  node.querySelector('.item__store').textContent = store ? `from ${store}` : '';

  const price = formatPrice(item.price);
  const priceEl = node.querySelector('.item__price');
  if (price) priceEl.textContent = price;
  else priceEl.remove();

  link.setAttribute('aria-label', [item.title, price, store && `from ${store}`].filter(Boolean).join(', '));
  return node;
}

function showError(heading, message) {
  document.title = 'Wishlist not found';
  $('title').textContent = heading;
  $('meta').textContent = message;
  $('sheet').classList.add('sheet--error');
}

async function load() {
  const shareId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');

  let res;
  try {
    res = await fetch(`/share/${encodeURIComponent(shareId)}`, { headers: { Accept: 'application/json' } });
  } catch {
    showError("Couldn't load this wishlist", 'Check your internet connection and refresh the page.');
    return;
  }

  if (res.status === 404) {
    showError('This wishlist link doesn’t work', 'The list may have been deleted, or the link was copied incompletely. Ask the person who sent it for a new link.');
    return;
  }
  if (!res.ok) {
    showError("Couldn't load this wishlist", 'Something went wrong on our end. Refresh the page to try again.');
    return;
  }

  const list = await res.json();
  document.title = `${list.name} · Wishlist`;
  $('title').textContent = list.name;

  const count = list.items.length;
  $('meta').textContent =
    count === 0 ? '' : `${count} ${count === 1 ? 'item' : 'items'}. Click on an item to open it in store.`;

  if (count === 0) {
    $('empty').hidden = false;
  } else {
    // Oldest first, the order they were added
    $('items').append(...list.items.map(renderItem));
  }
}

load().finally(() => $('sheet').setAttribute('aria-busy', 'false'));
