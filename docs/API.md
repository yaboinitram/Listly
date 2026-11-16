# Listly API

The Listly API is the Node.js and Express server in `server/`. The Chrome extension and the public share page both call it.

| Where | Base URL |
|---|---|
| Your computer | `http://localhost:3000` |
| Production | `https://YOUR-RAILWAY-DOMAIN` |

Every request and response body is JSON. Routes marked **(token)** need the header `Authorization: Bearer <token>`, using the token that register or login returns. A token lasts 7 days.

## Errors

Every error looks the same: `{ "error": "A message for the user." }`

| Status | Meaning |
|---|---|
| 400 | The input broke a rule. The message says which one. |
| 401 | The token is missing, invalid or expired, or the email and password don't match. |
| 404 | Not found, **or not yours**. The API never says which, so nobody can probe for other people's IDs. |
| 405 | A write sent to a share link. Share links are read-only. |
| 409 | That email already has an account. |
| 500 | A server problem. The body is always `Internal server error.` and the details go only to the server log. |

## Health

`GET /health` returns `200 {"status":"ok","database":"connected"}`, or `500 {"status":"error","database":"unreachable"}` when MySQL is down.

## Accounts

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `POST /auth/register` | `{ email, password }` | `201 { token, user: { user_id, email } }` | 400, 409 |
| `POST /auth/login` | `{ email, password }` | `200 { token, user: { user_id, email } }` | 400, 401 |

- The email must look like an email and be 255 characters or fewer. It is saved in lower case.
- The password must be 8 to 72 characters.
- A wrong password and an unknown email get the same `401 Invalid email or password.` and take the same time, so the API never reveals which emails have accounts.

## Wishlists (token)

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /wishlists` | | `200 [{ wishlist_id, name, share_id, item_count }]`, sorted by name. `share_id` is `null` until the list is shared. | |
| `POST /wishlists` | `{ name }` | `201 { wishlist_id, name }` | 400 |
| `PATCH /wishlists/:wishlistId` | `{ name }` | `200 { wishlist_id, name }` | 400, 404 |
| `DELETE /wishlists/:wishlistId` | | `204`. Its items are deleted too, and its share link stops working. | 404 |
| `POST /wishlists/:wishlistId/share` | | `201 { share_id }` the first time, then `200` with the same `share_id` | 404 |

A wishlist name is required, has spaces trimmed from both ends, and is 100 characters or fewer.

## Items (token)

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /wishlists/:wishlistId/items` | | `200 [{ item_id, title, price, image_url, source_url, date_added }]`, oldest first | 404 |
| `POST /wishlists/:wishlistId/items` | an item | `201`, the saved item | 400, 404 |
| `PUT /wishlists/:wishlistId/items/:itemId` | an item | `200`, the saved item. PUT replaces the whole item, so a field left out is cleared. | 400, 404 |
| `DELETE /wishlists/:wishlistId/items/:itemId` | | `204` | 404 |

| Item field | Required | Rules |
|---|---|---|
| `title` | yes | 1 to 255 characters after trimming |
| `source_url` | yes | an `http` or `https` link, 2048 characters or fewer |
| `price` | no | a number from 0 to 99999999.99, not text. GET returns it as text, like `"29.99"`. |
| `image_url` | no | an `http` or `https` link, 2048 characters or fewer |

## Share links (no token)

| Method and path | Success | Errors |
|---|---|---|
| `GET /share/:shareId` | `200 { name, items: [{ title, price, image_url, source_url }] }` | 404 |
| `POST`, `PUT`, `PATCH` or `DELETE /share/:shareId` | | `405`, with the header `Allow: GET` |

- The response never holds an ID, an email, or anything else about the owner.
- A share ID is 32 letters and digits. `404 Wishlist not found.` comes back for an unknown ID, a link with a character changed, a deleted wishlist, an empty ID (`/share/`), and anything that isn't 32 to 64 letters and digits. It is always JSON, never an HTML error page.

## Try it (Git Bash)

```bash
B=http://localhost:3000
TOKEN=$(curl -s -X POST $B/auth/register -H "Content-Type: application/json" \
  -d '{"email":"me1@listly.test","password":"password123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s -X POST $B/wishlists -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"Birthday"}'
curl -s $B/wishlists -H "Authorization: Bearer $TOKEN"
```

Use a new email each time; registering the same one twice returns 409.