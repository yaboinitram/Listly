const env = import.meta.env;

export const API_BASE_URL = (env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// The server also serves the public share page: <API_BASE_URL>/s/<share_id>
export const SHARE_BASE_URL = `${API_BASE_URL}/s/`;

// Wishlists are saved on the server. Set VITE_LOCAL_WISHLISTS=true in extension/.env to keep them
// inside the extension instead (no database needed, but share links won't work).
export const USE_MOCK_WISHLISTS = env.VITE_LOCAL_WISHLISTS === 'true';

// True when running as a real extension page (not `vite` in a normal browser tab).
export const IN_EXTENSION = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
