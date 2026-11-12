// Local stand-in for the wishlist routes, stored in chrome.storage.
// Same function names and response shapes as the server contract in api.js,
// so flipping VITE_MOCK_WISHLISTS=false needs no UI changes.
import { getItem, setItem, getSession } from './storage';

const KEY = 'listly.mockdb';
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));

async function load() {
  const session = await getSession();
  const owner = session?.user?.user_id || 'anonymous';
  const all = (await getItem(KEY)) || {};
  const db = all[owner] || { wishlists: [], items: [] };
  const save = async () => setItem(KEY, { ...all, [owner]: db });
  return { db, save };
}

function notFound() {
  const err = new Error('That wishlist no longer exists.');
  err.status = 404;
  return err;
}

function retailerName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function list() {
  await wait();
  const { db } = await load();
  return db.wishlists.map((w) => ({
    ...w,
    item_count: db.items.filter((i) => i.wishlist_id === w.wishlist_id).length,
  }));
}

export async function create(name) {
  await wait();
  const { db, save } = await load();
  const wishlist = { wishlist_id: crypto.randomUUID(), name: name.trim().slice(0, 100), share_id: null };
  db.wishlists.push(wishlist);
  await save();
  return { ...wishlist, item_count: 0 };
}

export async function rename(id, name) {
  await wait();
  const { db, save } = await load();
  const w = db.wishlists.find((x) => x.wishlist_id === id);
  if (!w) throw notFound();
  w.name = name.trim().slice(0, 100);
  await save();
  return w;
}

export async function remove(id) {
  await wait();
  const { db, save } = await load();
  db.wishlists = db.wishlists.filter((w) => w.wishlist_id !== id);
  db.items = db.items.filter((i) => i.wishlist_id !== id);
  await save();
  return null;
}

export async function share(id) {
  await wait();
  const { db, save } = await load();
  const w = db.wishlists.find((x) => x.wishlist_id === id);
  if (!w) throw notFound();
  if (!w.share_id) w.share_id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  await save();
  return { share_id: w.share_id };
}

export async function listItems(id) {
  await wait();
  const { db } = await load();
  if (!db.wishlists.some((w) => w.wishlist_id === id)) throw notFound();
  return db.items
    .filter((i) => i.wishlist_id === id)
    .sort((a, b) => b.date_added.localeCompare(a.date_added));
}

export async function addItem(id, item) {
  await wait();
  const { db, save } = await load();
  if (!db.wishlists.some((w) => w.wishlist_id === id)) throw notFound();
  const saved = {
    item_id: crypto.randomUUID(),
    wishlist_id: id,
    title: item.title.slice(0, 255),
    price: item.price ?? null,
    image_url: item.image_url || null,
    source_url: item.source_url,
    retailer_name: retailerName(item.source_url),
    date_added: new Date().toISOString(),
  };
  db.items.push(saved);
  await save();
  return saved;
}

export async function removeItem(id, itemId) {
  await wait();
  const { db, save } = await load();
  db.items = db.items.filter((i) => !(i.wishlist_id === id && i.item_id === itemId));
  await save();
  return null;
}
