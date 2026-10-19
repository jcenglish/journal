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
| Deploy   | Kamal (Docker)                                                |

## Layout

```
backend/    Rails API — owns the /api prefix, JSON only
frontend/   React + TypeScript SPA (Vite)
docker-compose.yml   local Postgres
deploy/     production-style stack: nginx (HTTPS), Rails, Postgres
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

`deploy/docker-compose.yml` runs nginx, Rails, and Postgres. nginx is the only published entry point
(ports 80 and 443): it terminates TLS, serves the built frontend, and proxies
`/api/` to Rails, so the browser sees a single origin. Its config is
`deploy/nginx/nginx.conf`. See `docs/design-decisions.md` for why this is
compose with nginx and not Kamal.

### 1. Hostname and DNS

Pick a hostname (for example `journal.lan`) and make it resolve to the server's
LAN IP: a local DNS record on your router, or an `/etc/hosts` entry on each
device. Give the server a fixed IP (DHCP reservation).

### 2. Issue the certificate (on your dev machine, not the server)

```sh
deploy/scripts/issue-cert.sh journal.lan 192.168.1.50
```

This creates a private CA in `~/.journal-ca/` the first time (`ca.key`,
`ca.pem`) and writes a 365-day leaf certificate to `deploy/certs/fullchain.pem`
and `deploy/certs/key.pem` with the hostname and IP as SANs. Copy only those
two files to the server's `deploy/certs/` (`chmod 600 key.pem`). Keep `ca.key`
off the server and out of git, and back it up somewhere safe. The certs are
gitignored.

To reissue before expiry, rerun the script (it reuses the existing CA, so
devices don't need a new root), copy the two files over, and run
`docker compose -f deploy/docker-compose.yml restart nginx`.

### 3. Trust the root CA on each device

Send `~/.journal-ca/ca.pem` to the device, then:

- **iOS:** open the file and install the profile (Settings → General → VPN &
  Device Management), then turn it on under Settings → General → About →
  Certificate Trust Settings ("Enable full trust for root certificates").
- **Android:** Settings → Security → Encryption & credentials → Install a
  certificate → CA certificate (menu names vary by vendor).
- **macOS/Windows/Linux browsers:** import `ca.pem` into the system trust store
  (Keychain Access → set to Always Trust; Windows: Trusted Root Certification
  Authorities). Chrome and Safari use it. **Firefox** keeps its own store:
  Settings → Privacy & Security → Certificates → View Certificates →
  Authorities → Import, tick "Trust this CA to identify websites".

### 4. Configure and start

```sh
cp deploy/.env.example deploy/.env   # set APP_HOST, RAILS_MASTER_KEY, BACKEND_DATABASE_PASSWORD
docker compose -f deploy/docker-compose.yml up -d --build
```

`APP_HOST` must match the hostname in the certificate. Always browse via that
hostname: Rails rejects requests that arrive with any other `Host`, including
the bare IP (which is in the certificate only so TLS validates). Postgres reads
`BACKEND_DATABASE_PASSWORD` only when its volume is first created, so changing
it later means resetting the volume (`docker compose down -v` deletes all data)
or changing the password inside Postgres. `deploy/.env` is
gitignored; never commit it, `master.key`, or anything in `deploy/certs/`.
