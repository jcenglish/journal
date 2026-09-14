# Journal

A private, single-user journaling app. Entries carry a date (sometimes backdated), an
optional title, a mood and health rating, and tags.

Everything personal is **encrypted in the browser before it reaches the server**.
The server stores ciphertext and never sees the encryption key, so a database
dump — or a compromised server — yields nothing readable. The trade-off is that
there is no password reset: losing the password means losing the data.

- `design-decisions.md` — why things are built the way they are, and what was rejected.
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

## API

Rails owns the `/api` prefix rather than having a proxy rewrite it away, so the
Vite dev proxy and any production edge proxy stay the same trivial rule.

| Method   | Path           | Purpose                                  |
| -------- | -------------- | ---------------------------------------- |
| `POST`   | `/api/signup`  | Create an account                        |
| `POST`   | `/api/session` | Log in                                   |
| `DELETE` | `/api/session` | Log out                                  |
| `GET`    | `/api/me`      | Current user                             |
| `GET`    | `/up`          | Health check (outside `/api`, for Kamal) |

Journal, entry, and tag endpoints coming soon.

## Deployment

Kamal, configured in `backend/config/deploy.yml` and `backend/.kamal/`. The
frontend builds to static assets with `npm run build`.
