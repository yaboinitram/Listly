# Listly
Chrome Browser Extension that allows a user to wishlist an item from any retail website

**Status:** Database and authentication API (register/login) are working. Wishlists, sharing, the extension, and the share page are in progress.


Folders and their contents
|---|---|
| `database/schema.sql`, MySQL schema (auto-loaded by Docker)
| `server/`, Node.js + Express API
| `extension/`, Chrome extension (not started)
| `web/`, Public share-view page (not started)

## Setup

Install these:

- [Node.js LTS](https://nodejs.org) (includes npm)
- [Git](https://git-scm.com) (duh)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be **open and running**)

## First-time setup

From the repo root:

```
In Terminal:
# 1. Clone and enter the repo
git clone <repo-url>
cd Listly

# 2. Start the MySQL database (loads schema.sql on first run)
docker compose up -d

# 3. Set up the server
in terminal: 
cd server
copy .env.example .env
npm install
```

Open `server/.env` and fill in the values. For local development:

```
PORT=3000
DB_HOST=localhost
DB_USER=listly_app
DB_PASSWORD=devpass
DB_NAME=listly_dev
JWT_SECRET=<random long string, look at later>
```

## Run the server

```
cd server
npm run dev
```

Then open http://localhost:3000/health in a browser. You should see:

```json
{"status":"ok","database":"connected"}
IF THIS IS NOT WORKING FOR YOU MESSAGE ME ON DISCORD AND I CAN TAKE A LOOK
```

## Quick test (PowerShell)

```open a powershell terminal separate from your other terminal.
$body = @{ email = "test@example.com"; password = "password123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/register -ContentType "application/json" -Body $body

This test regsiters a new user account by sending a request to the API
the first line actually has to build out a request body because our integration hasn't fully set that up yet.
then the second line actually makes the rest request to post to the database
```

A `token` and `user` in the response means the registration module works

## Daily workflow

1. Open Docker Desktop.
2. `docker compose up -d` (from the repo root)
3. `cd server` then `npm run dev`
4. When done: `docker compose down` (keeps your data)

## Resetting the database

`-v` deletes all local data.

## Git workflow

Don't commit directly to `main`. Make a branch (`feature/<name>`), push it, and open a pull request.
If you're unfamiliar with using git tools please dm me on discord
