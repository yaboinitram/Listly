# Listly extension: popup front end

## Run it

Start Docker and the server first (see the main README). Then, in a second terminal:

```
cd extension
copy .env.example .env      # first time only (Mac: cp .env.example .env)
npm install                 # first time, or after package.json changes
npm run dev
```

First time only: open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and pick the `extension/dist` folder.

**Always open Listly from the toolbar icon while you're on the store page.** That click is what gives Listly permission to read the page. `npm run dev` also serves the popup at http://localhost:5173/src/popup/index.html for working on the UI, but there it shows a sample product and a "Preview mode" note, because a normal tab can't read other pages.

After editing `manifest.json`: stop `npm run dev`, start it again, and click reload on Listly in `chrome://extensions`.

## Troubleshooting

Right-click inside the popup → **Inspect** → **Console**. Every page read logs `[Listly] read page:` with what was found, or `[Listly] could not read page:` with Chrome's reason.

| What you see | Cause |
|---|---|
| "Chrome didn't let Listly read this page" on every site | Extension wasn't reloaded after a manifest change, or the popup isn't being opened from the toolbar. |
| "No price found on this page" | The page was read, but the store doesn't publish its price in a standard way. Type it in. To dig in, paste `scrapeProduct` from `src/lib/scrapeProduct.js` (without the word `export`) into the store page's console and run `scrapeProduct()`. |
| "Open a product page to save it" | You're on a new tab, settings or another `chrome://` page. |
| "Can't reach the Listly server" | The server or Docker isn't running. |

## What's here

| Screen | What it does |
|---|---|
| Sign in / Create account | Calls the real `/auth/login` and `/auth/register`. The token is kept in `chrome.storage.local`. |
| Home | The save card reads the product on the current tab (name, price, image, URL), lets you edit it, pick a list (or start a new one) and save. Below it are your lists. |
| List | Items with price and store, open the product, remove an item, rename the list (click the name), copy a share link, delete the list. |

If the server ever answers 401 (expired token), the popup signs out and returns to sign-in.

## Files

```
src/lib/
  config.js         env settings (API URL, share URL, mock flag)
  storage.js        chrome.storage wrapper + session helpers
  api.js            fetch wrapper, auth calls, wishlist calls (server contract documented inline)
  mockBackend.js    local stand-in for the wishlist routes
  scrapeProduct.js  runs inside the shopping page; JSON-LD -> meta tags -> microdata -> h1/title
  currentPage.js    injects the scraper into the active tab
  format.js         price / hostname / plural helpers
src/popup/
  Popup.jsx         session + simple routing between views
  views/            AuthView, HomeView, WishlistView
  components/       SaveCard (the gift tag), Thumb, Toast, Icons
  popup.css         all popup styles; colors are tokens at the top, with a dark mode
```

This version removed the old Vite template (`src/App.jsx`, `src/App.css`, `src/main.jsx`, `src/index.css`, `src/assets/react.svg`, root `index.html`) and the plain skeleton (`src/popup/AuthForm.jsx`, `Wishlists.jsx`, `WishlistDetail.jsx`, `src/popup/api.js`).

Wishlists in mock mode are stored per account (keyed by `user_id`), so different accounts on the same browser see their own lists. The session is stored under a new key, so anyone signed in with the old skeleton has to sign in once more.

## Mock mode

The server only has auth so far, so wishlists and items are stored locally in the extension while `VITE_MOCK_WISHLISTS=true` (the default). Sign in still uses the real server. Once the routes below exist, set `VITE_MOCK_WISHLISTS=false` in `extension/.env` and restart `npm run dev`; no UI code changes.

## API contract the popup expects

All routes require `Authorization: Bearer <token>` and should only touch wishlists owned by `req.user.user_id` (404 otherwise). Errors use the existing `{ "error": "message" }` shape; the popup shows that message to the user.

| Method & path | Body | Response |
|---|---|---|
| `GET /wishlists` | | `[{ wishlist_id, name, share_id, item_count }]` |
| `POST /wishlists` | `{ name }` | `201` wishlist (with `item_count: 0`) |
| `PATCH /wishlists/:id` | `{ name }` | wishlist |
| `DELETE /wishlists/:id` | | `204` |
| `POST /wishlists/:id/share` | | `{ share_id }`; returns the existing id if the list is already shared |
| `GET /wishlists/:id/items` | | `[{ item_id, title, price, image_url, source_url, date_added, retailer_name }]`, newest first |
| `POST /wishlists/:id/items` | `{ title, price, image_url, source_url }` | `201` item |
| `DELETE /wishlists/:id/items/:itemId` | | `204` |

Already on the server: `wishlistRepository` has `create` and `listByOwner`, and `itemRepository` has `insert` and `listForOwnedWishlist`. Those cover `GET/POST /wishlists` and `GET/POST /wishlists/:id/items` once routes call them. Note the repository takes `imageUrl`/`sourceUrl` while the popup sends `image_url`/`source_url`, so the route should map between them. `GET /wishlists` also needs `share_id` and an `item_count` (a `COUNT` join) added to `listByOwner`.

Notes for the server side:
- `price` may be `null`. `image_url` may be `null`.
- `retailer_name` can come from joining `retailers` on the URL's domain (create the retailer row on first save if it doesn't exist).
- Share links are built as `VITE_SHARE_BASE_URL + share_id` (default `http://localhost:5174/s/`), for the `web/` share page.

## Known gaps

- Currency: the scraper reads it, but the schema has no currency column, so prices are shown in USD.
- No "mark as purchased" in the popup; that belongs to the share page.
- Items can't be moved between lists or edited after saving yet.
