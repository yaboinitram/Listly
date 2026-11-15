# Developer setup: Listly API

How to run and test the API server on your own computer. To install and use the extension, see the main README. For every endpoint, see [API.md](API.md).

## You need

- **Node.js 22**, the version CI uses
- **Git**, and on Windows use **Git Bash**. PowerShell blocks `npm` by default.
- **Docker Desktop**, open and running

## First time

From the repo root:

```bash
docker compose up -d
cd server
cp .env.example .env
npm install
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`docker compose up -d` starts MySQL 8 with two databases: `listly_dev` (with the schema loaded) for running the app, and `listly_test` for the tests.

Open `server/.env` and set:

```
PORT=3000
DB_HOST=localhost
DB_USER=listly_app
DB_PASSWORD=devpass
DB_NAME=listly_dev
JWT_SECRET=<paste the 64 characters the node command printed>
```

Never commit `.env`. `.gitignore` already skips it.

## Every day

```bash
docker compose up -d     # from the repo root
cd server
npm run dev
```

Open http://localhost:3000/health and look for `"database":"connected"`. Stop the server with Ctrl+C, then run `docker compose down`, which keeps your data. `docker compose down -v` deletes it.

## Tests

| Command, from `server/` | What it runs |
|---|---|
| `npm test` | Everything, exactly as CI runs it |
| `npm run test:unit` | Unit tests only. No database needed. |
| `npm run test:integration` | Integration tests. Resets `listly_test` first. |

Integration tests need Docker running. The `◇ injected env (0) from .env` lines in the output are normal.

## How the code is laid out

```
server/
  src/
    index.js            checks the environment variables, then starts the server
    app.js              middleware, routes, and the error handler
    routes/             reads the request and sends the response
    services/           rules and validation; throws httpError(status, message)
    repositories/       every SQL query; owner queries always include owning_user_id
    middleware/         authenticate.js checks the token and sets req.user
    db.js               the MySQL connection pool
  tests/
    unit/               services tested with fake repositories
    integration/        real HTTP requests against listly_test
  scripts/
    resetTestDb.js      rebuilds listly_test before the integration tests
    loadTest.js         the performance check (PERF-03 to PERF-06)
```

To add an endpoint: write the repository function, then the service function with its validation, then the route, then a unit test with the repository mocked, then an integration test.

## CI

`.github/workflows/ci.yml` runs `npm ci` and `npm test` on Linux with MySQL 8 for every push and pull request. `main` only accepts a pull request once the **API tests** check passes.

Linux cares about capital letters and Windows doesn't. `require('../shareId')` needs a file named exactly `shareId.js`. To see file names the way CI does, run `git ls-files`.

## Load test

With the server running, from `server/` in a second window:

```bash
node scripts/loadTest.js
```

It prints a pass or fail for each target and deletes its test account when it finishes.

## Production

The API runs on Railway. Its settings live in the Railway dashboard, never in a file:

| Variable | Value |
|---|---|
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_USER` | the production database user |
| `DB_PASSWORD` | that user's password |
| `DB_NAME` | `listly_prod` |
| `JWT_SECRET` | its own secret, never the development one |
| `NODE_ENV` | `production` |

Railway sets `PORT` itself.

## Troubleshooting

| You see | Fix |
|---|---|
| `npm.ps1 cannot be loaded` | Use Git Bash instead of PowerShell. |
| `connect ECONNREFUSED 127.0.0.1:3306` | Open Docker Desktop and run `docker compose up -d`. |
| `Access denied for user ''@...` | There's no `server/.env`, or you aren't in `server/`. |
| `Access denied for user 'listly_app'... to database 'listly_test'` | Your Docker volume is older than the test database. From the repo root: `docker compose exec -T db mysql -uroot -prootpass < database/init-test-db.sql` |
| `JWT_SECRET must be at least 32 characters` | Make one with the `node -e` command above. |
| Tests pass on Windows but CI says `Cannot find module` | A file name's capital letters don't match its `require`. |