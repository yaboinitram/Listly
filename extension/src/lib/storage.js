// Thin wrapper over chrome.storage.local with a localStorage fallback,
// so the popup can also be previewed with `npm run dev` in a normal tab.
const hasChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);

export async function getItem(key) {
  if (hasChromeStorage) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  if (hasChromeStorage) return chrome.storage.local.set({ [key]: value });
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable; ignore */
  }
}

export async function removeItem(key) {
  if (hasChromeStorage) return chrome.storage.local.remove(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const SESSION_KEY = 'listly.session';

/** @returns {Promise<{ token: string, user: { user_id: string, email: string } } | null>} */
export const getSession = () => getItem(SESSION_KEY);
export const saveSession = (session) => setItem(SESSION_KEY, session);
export const clearSession = () => removeItem(SESSION_KEY);

const LAST_LIST_KEY = 'listly.lastWishlistId';
export const getLastWishlistId = () => getItem(LAST_LIST_KEY);
export const setLastWishlistId = (id) => setItem(LAST_LIST_KEY, id);
