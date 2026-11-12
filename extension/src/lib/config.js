const env = import.meta.env;

export const API_BASE_URL = (env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const SHARE_BASE_URL = env.VITE_SHARE_BASE_URL || 'http://localhost:5174/s/';

// Until the server has /wishlists routes, keep wishlist data inside the extension.
// Set VITE_MOCK_WISHLISTS=false in extension/.env to use the real API.
export const USE_MOCK_WISHLISTS = env.VITE_MOCK_WISHLISTS !== 'false';

// True when running as a real extension page (not `vite` in a normal browser tab).
export const IN_EXTENSION = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
