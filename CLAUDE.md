# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project structure

This is a monorepo with two independent, currently-unconnected projects:

- `backend/` — Rails 8.1 API-only application (Ruby 4.0.6, PostgreSQL via `pg`, Puma).
- `frontend/` — React 19 + TypeScript app scaffolded with Vite.

Both are fresh framework scaffolds (default Rails API app / default `npm create vite` React-TS template) with no custom domain models, controllers, routes, or components yet, and no CORS or API wiring between them. When adding the first real features, this section and the notes below should be expanded.

## Backend (`backend/`)

Rails 8.1, `config.api_only = true`. Uses the Solid trio (`solid_cache`, `solid_queue`, `solid_cable`) instead of Redis, so background jobs/cache/cable are backed by the database (see `db/cache_schema.rb`, `db/queue_schema.rb`, `db/cable_schema.rb`, `config/recurring.yml`). Deployment is via Kamal (`config/deploy.yml`, `.kamal/`).

All commands below are run from `backend/`.

```sh
bin/setup              # bundle install, db:prepare, clear logs/tmp; then starts the server
bin/setup --skip-server
bin/dev                # starts the Rails server (bin/rails server)

bin/rails test                        # full test suite (Minitest)
bin/rails test test/models/foo_test.rb        # single file
bin/rails test test/models/foo_test.rb:12     # single test at line 12

bin/rubocop             # style check (rubocop-rails-omakase)
bin/rubocop -A          # autocorrect
bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error   # static security analysis
bin/bundler-audit       # gem vulnerability audit
```

`bin/ci` (defined in `config/ci.rb`) runs the full CI pipeline in order: setup → rubocop → bundler-audit → brakeman → `bin/rails test` → `db:seed:replant` in the test environment. Run this before considering backend work done.

Database config (`config/database.yml`) expects a local Postgres with databases `backend_development` / `backend_test`; production uses `DATABASE_URL`/`BACKEND_DATABASE_PASSWORD` env vars and splits primary/cache/queue/cable databases.

## Frontend (`frontend/`)

React 19 + TypeScript, built with Vite. All commands below are run from `frontend/`.

```sh
npm run dev        # Vite dev server with HMR
npm run build       # tsc -b (project references, type-check only) then vite build
npm run lint        # eslint .
npm run preview     # preview a production build
```

There is no test runner configured yet.

ESLint config (`eslint.config.js`) is flat-config based: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (Vite variant). Type-aware lint rules are not enabled (see `frontend/README.md` for how to add `tseslint.configs.recommendedTypeChecked`/`strictTypeChecked` if needed later).
