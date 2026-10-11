# Journal

**Functionally complete!**

A private journaling app that multiple authenticated users can use. Entries carry a date (sometimes backdated), an
optional title, a mood and health rating, and tags.

Everything personal is **encrypted in the browser before it reaches the server**.
The server stores ciphertext and never sees the encryption key, so a database
dump — or a compromised server — yields nothing readable. **The trade-off is that
there is no password reset: losing the password means losing the data.**

- `docs/design-decisions.md` — why things are built the way they are, what was rejected, and future features.
- `CLAUDE.md` — conventions and data model, for both humans and Claude Code.

## Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| Backend  | Rails 8.1 (`api_only`), Ruby 4.0.6, Puma                      |
| Database | PostgreSQL 18                                                 |
| Frontend | React 19, TypeScript, Vite, CSS Modules                       |
| Crypto   | Web Crypto API, client-side only                              |
| Tests    | Minitest (backend), Vitest + React Testing Library (frontend) |
| Deploy   | Docker Compose + Caddy (self-hosted, LAN)                     |

## Layout

```
backend/    Rails API — owns the /api prefix, JSON only
frontend/   React + TypeScript SPA (Vite)
docker-compose.yml   local Postgres (dev)
deploy/     self-hosting: Compose stack, Caddyfile, web image
```

## Prerequisites

- Ruby 4.0.6 (see `backend/.ruby-version`)
- Node 22 (see `frontend/.nvmrc`)
- Docker, for the local Postgres

## Getting started

**1. Start Postgres** (from the repo root):

```sh
docker compose up -d postgres
```

This listens on `localhost:5432` with user/password `backend`/`backend`. Both
`docker-compose.yml` and `backend/config/database.yml` read the same
`BACKEND_DATABASE_USERNAME` / `BACKEND_DATABASE_PASSWORD` env vars, so export
overrides rather than editing the two files separately.

**2. Set up and run the backend** (from `backend/`):

```sh
bin/setup                # bundle install, db:prepare, clear logs/tmp, then start the server
bin/setup --skip-server  # same without starting it
bin/dev                  # start the Rails server on :3000
```

**3. Run the frontend** (from `frontend/`, in a second terminal):

```sh
npm install
npm run dev              # Vite dev server on :5173
```

Open the Vite URL, not the Rails one. Vite proxies `/api` to Rails on port 3000
so the browser stays on a single origin — the session cookie works with
`SameSite=Lax` and there's no CORS configuration at all.

## Environment

Currently, local development needs no `.env`; the defaults in `config/database.yml` match
`docker-compose.yml`. Overridable:

| Variable                    | Default     | Used by                           |
| --------------------------- | ----------- | --------------------------------- |
| `BACKEND_DATABASE_HOST`     | `localhost` | dev/test only                     |
| `BACKEND_DATABASE_PORT`     | `5432`      | dev/test only                     |
| `BACKEND_DATABASE_USERNAME` | `backend`   | dev/test + Docker                 |
| `BACKEND_DATABASE_PASSWORD` | `backend`   | dev/test + Docker, and production |
| `DATABASE_URL`              | —           | production                        |
| `RAILS_MAX_THREADS`         | `5`         | connection pool size              |

## Tests and checks

**Backend** (from `backend/`):

```sh
bin/ci                                     # full pipeline — run this before calling work done
bin/rails test                             # Minitest suite
bin/rails test test/models/foo_test.rb:12  # a single test
bin/rubocop                                # style (rubocop-rails-omakase); -A to autocorrect
bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error
bin/bundler-audit
```

`bin/ci` (defined in `config/ci.rb`) runs setup → RuboCop → bundler-audit →
Brakeman → tests → seed replant in the test environment.

**Frontend** (from `frontend/`):

```sh
npm run test        # vitest run
npm run test:watch
npm run lint        # eslint
npm run build       # tsc -b, then vite build
npm run preview     # preview a production build
```

Vitest runs with `globals: false`, so test files import `describe`/`it`/`expect`
from `vitest` explicitly. `src/test/setup.ts` registers Testing Library cleanup
and polyfills Web Crypto, which jsdom doesn't implement.

CI (`.github/workflows/ci.yml`) runs the backend and frontend jobs in parallel on
every push to `main` and every PR.

## Deployment

Self-hosted on a LAN box with Docker Compose (`deploy/`): Postgres, the Rails
API, and Caddy, which serves `frontend/dist` at `/`, proxies `/api` to Rails, and
terminates TLS. One origin, which the cookie/CSRF design requires. HTTPS is
mandatory, not cosmetic: Web Crypto (`crypto.subtle`) only exists in secure
contexts, so the app can't derive keys over plain `http://<lan-ip>`.

```sh
cd deploy
cp .env.example .env     # set APP_HOST, RAILS_MASTER_KEY, BACKEND_DATABASE_PASSWORD
docker compose up -d --build
```

`APP_HOST` is the hostname you'll visit and must resolve to the server (router
DNS entry, `/etc/hosts`, or a Tailscale name). It's used for the TLS cert and
Rails' host allowlist. Pick a TLS source with `TLS_ARGS` in `deploy/.env`:

- **`internal` (default, what this setup uses):** Caddy's own CA. Leaf certs
  renew automatically; the root is valid for 10 years. Trust it once per device:
  1. On the server, after the first `up`:
     `docker compose cp web:/data/caddy/pki/authorities/local/root.crt .`
  2. Get `root.crt` onto the phone (AirDrop, email, or a USB transfer).
  3. **iOS:** open the file, allow the profile download, install it under
     Settings > General > VPN & Device Management, then enable it under
     Settings > General > About > Certificate Trust Settings.
     **Android:** Settings > Security > Encryption & credentials > Install a
     certificate > CA certificate.
  4. Visit `https://<APP_HOST>`; there should be no warning.
- **Real cert, no device setup:** put `fullchain.pem` and `key.pem` in
  `deploy/certs/` and set `TLS_ARGS=/certs/fullchain.pem /certs/key.pem`, e.g.
  from `tailscale cert <name>.ts.net` with `APP_HOST=<name>.ts.net`.

The Caddyfile sends a Content-Security-Policy as `Content-Security-Policy-Report-Only`,
so violations are logged in the browser console but nothing is blocked. Open
the site on a desktop browser with DevTools, use the app (sign up, create a
journal, write an entry), and check the console for "Content Security Policy"
messages. When there are none, rename the header to `Content-Security-Policy`
in `deploy/Caddyfile` to enforce it.

Update with `git pull && docker compose up -d --build`; migrations run on boot.
Back up with `docker compose exec postgres pg_dump -U backend backend_production`
(plus the `_cache`, `_queue`, `_cable` databases if you care about them; only
the first holds journal data, and it's ciphertext). `config/master.key` is
needed to boot and isn't in git, so keep a copy somewhere safe. If you use the
`internal` CA, the `caddy-data` volume holds its root key; deleting it (e.g.
`down -v`) means re-trusting a new root cert on every device.

`backend/config/deploy.yml` (Kamal) is still the Rails default and isn't used.
