import { API_BASE_URL, USE_MOCK_WISHLISTS } from './config';
import { getSession, clearSession } from './storage';
import * as mockBackend from './mockBackend';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let unauthorizedHandler = () => {};
/** Called when the server rejects our token, so the popup can return to sign-in. */
export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const session = await getSession();
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Can't reach the Listly server at ${API_BASE_URL}. Check that it's running.`, 0);
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && auth) {
      await clearSession();
      unauthorizedHandler();
    }
    throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status);
  }
  return data;
}

// ---- Auth (live on the server today) ---------------------------------------
export const authApi = {
  register: (email, password) =>
    request('/auth/register', { method: 'POST', body: { email, password }, auth: false }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
};

// ---- Wishlists & items -------------------------------------------------------
// Expected server contract (see extension/FRONTEND.md). All routes need a Bearer token.
const serverWishlists = {
  /** GET /wishlists -> [{ wishlist_id, name, share_id, item_count }] */
  list: () => request('/wishlists'),
  /** POST /wishlists { name } -> wishlist */
  create: (name) => request('/wishlists', { method: 'POST', body: { name } }),
  /** PATCH /wishlists/:id { name } -> wishlist */
  rename: (id, name) => request(`/wishlists/${id}`, { method: 'PATCH', body: { name } }),
  /** DELETE /wishlists/:id -> 204 */
  remove: (id) => request(`/wishlists/${id}`, { method: 'DELETE' }),
  /** POST /wishlists/:id/share -> { share_id } (returns the existing id if already shared) */
  share: (id) => request(`/wishlists/${id}/share`, { method: 'POST' }),
  /** GET /wishlists/:id/items -> [{ item_id, title, price, image_url, source_url, date_added, retailer_name }] */
  listItems: (id) => request(`/wishlists/${id}/items`),
  /** POST /wishlists/:id/items { title, price, image_url, source_url } -> item */
  addItem: (id, item) => request(`/wishlists/${id}/items`, { method: 'POST', body: item }),
  /** DELETE /wishlists/:id/items/:itemId -> 204 */
  removeItem: (id, itemId) => request(`/wishlists/${id}/items/${itemId}`, { method: 'DELETE' }),
};

export const wishlistApi = USE_MOCK_WISHLISTS ? mockBackend : serverWishlists;
