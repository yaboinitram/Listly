/* global chrome */
// All server calls live here so the components stay simple.
const API_URL = 'http://localhost:3000';

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  // Attach the saved token if we have one
  const { token } = await chrome.storage.local.get('token');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

// ---- Auth: these routes exist on the server ----
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password } });

export const register = (email, password) =>
  request('/auth/register', { method: 'POST', body: { email, password } });

// ---- Wishlists: these routes DON'T exist on the server yet ----
// For now they read/write chrome.storage so the UI works.
// When the server routes are built, swap each body for the request(...) in its comment.

async function loadLocal() {
  const { localData } = await chrome.storage.local.get('localData');
  return localData || { wishlists: [], items: [] };
}
const saveLocal = (localData) => chrome.storage.local.set({ localData });

// TODO server: return request('/wishlists');
export async function getWishlists() {
  const data = await loadLocal();
  return data.wishlists;
}

// TODO server: return request('/wishlists', { method: 'POST', body: { name } });
export async function createWishlist(name) {
  const data = await loadLocal();
  const wishlist = { wishlist_id: crypto.randomUUID(), name };
  data.wishlists.push(wishlist);
  await saveLocal(data);
  return wishlist;
}

// TODO server: return request(`/wishlists/${wishlistId}`, { method: 'DELETE' });
export async function deleteWishlist(wishlistId) {
  const data = await loadLocal();
  data.wishlists = data.wishlists.filter((w) => w.wishlist_id !== wishlistId);
  data.items = data.items.filter((i) => i.wishlist_id !== wishlistId);
  await saveLocal(data);
}

// TODO server: return request(`/wishlists/${wishlistId}/items`);
export async function getItems(wishlistId) {
  const data = await loadLocal();
  return data.items.filter((i) => i.wishlist_id === wishlistId);
}

// TODO server: return request(`/wishlists/${wishlistId}/items`, { method: 'POST', body: item });
export async function addItem(wishlistId, item) {
  const data = await loadLocal();
  const newItem = { ...item, item_id: crypto.randomUUID(), wishlist_id: wishlistId };
  data.items.push(newItem);
  await saveLocal(data);
  return newItem;
}

// TODO server: return request(`/wishlists/${wishlistId}/items/${itemId}`, { method: 'DELETE' });
export async function removeItem(wishlistId, itemId) {
  const data = await loadLocal();
  data.items = data.items.filter((i) => i.item_id !== itemId);
  await saveLocal(data);
}
