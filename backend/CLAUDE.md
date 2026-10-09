# Backend (`backend/`)

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

`bin/rails test` also writes `coverage/lcov.info` (via `simplecov-lcov`, configured in `test/test_helper.rb`). The `patch-coverage` CI job reads it to check that the lines a PR changes are at least 80% covered (see the root `CLAUDE.md` Definition of done).

Database config (`config/database.yml`) expects a local Postgres with databases `backend_development` / `backend_test`; production uses `DATABASE_URL`/`BACKEND_DATABASE_PASSWORD` env vars and splits primary/cache/queue/cable databases.

Local Postgres runs in Docker (Postgres 18 — see `docker-compose.yml` at repo root), reached over TCP rather than the default domain socket:

```sh
docker compose up -d postgres   # from repo root; starts Postgres 18 on localhost:5432
```

`config/database.yml` reads connection details from `BACKEND_DATABASE_HOST`/`_PORT`/`_USERNAME`/`_PASSWORD` env vars, defaulting to `localhost:5432` / `backend` / `backend`; `docker-compose.yml` reads the same var names for its Postgres user/password, so both stay in sync if you export overrides rather than hand-editing two files.
