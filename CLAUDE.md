# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For the reasoning behind the architectural decisions below (why zero-knowledge over server-side encryption, why fields are shaped the way they are, what's deliberately deferred), see `design-decisions.md`. This file is the "what to build," that one is the "why."

## Project structure

Monorepo with two projects:

- `backend/` — Rails 8.1 API-only application (Ruby 4.0.6, PostgreSQL via `pg`, Puma).
- `frontend/` — React 19 + TypeScript app scaffolded with Vite.

Domain models, controllers, routes, and components are being built incrementally, one vertical slice per GitHub issue (see Workflow below). The data model and conventions below describe the target shape — implement against them even before every piece exists yet.

## Data model

- **User** — `password_digest` (`has_secure_password`), `email`.
- **Journal** — `title`, `fk:user`. Single-user only, not collaborative. Cover image via Active Storage (`has_one_attached`) — deferred, not in MVP scope.
- **Entry** — `content`, `title` (optional), `mood` (1–5), `health` (1–5), `entry_date` (distinct from `created_at` — entries are often backdated), `fk:journal`. **No `fk:user`** — derive via `entry.journal.user` to avoid the two drifting out of sync. Images via Active Storage (`has_many_attached`) — deferred, not in MVP scope.
- **Tag** — `content`, `color`, `fk:user`. Scoped per user, not global.
- **TagEntries** — `fk:tag`, `fk:entry`. Unique composite index on `(tag_id, entry_id)`.
- **DB-level constraints**: `CHECK` on `mood` and `health` (1–5) at the Postgres level, not just app validations.

## Security & encryption

This app uses **zero-knowledge, client-side encryption** for entry content — not Rails' built-in `encrypts`. The server must never receive plaintext entry content or the key that protects it.

- On login, derive an encryption key from the user's password client-side (Web Crypto API) and hold it in memory for the session only.
- Encrypt entry content in the browser before sending it to the server; decrypt in the browser when displaying it.
- There is no password reset. Losing the password means losing the data. This must be stated clearly on the Auth screen — don't let this be a silent gap.
- Search cannot use SQL (`LIKE`/`ILIKE`) against encrypted content. When search is built (post-MVP), it uses client-side blind indexing (hashed tokens generated and uploaded from the browser) — see `design-decisions.md`.
- **Every backend query must be scoped to `current_user`** (e.g., `current_user.journals.find(params[:id])`, never a bare `Journal.find`). This is the standard IDOR risk and matters even more here since encryption doesn't help if authorization is broken. Backend request specs should include at least one test per resource asserting a user cannot access another user's data.

## Frontend conventions

- File organization is by type, not by feature: `src/components/`, `src/pages/`, `src/hooks/`, `src/lib/`. Add these folders as the first slice that needs them, rather than pre-scaffolding empty ones.
- TypeScript for all frontend code.
- CSS Modules for styling — no Tailwind, no styled-components, no CSS-in-JS.
- Mobile-first. No breadcrumb navigation (use a back chevron + screen title in the header instead) and no desktop-style left/right split panels (collapse secondary content like search/tags into a filter drawer or bottom sheet instead).
- Entry content editor is **TipTap**, via its official open-source Simple Editor template (`npx @tiptap/cli add simple-editor`) — not BlockNote. The app only needs text + images, not BlockNote's Notion-style block model (drag handles, slash menu, nested blocks). Content still serializes to a ProseMirror JSON doc — account for that shape (not plain text) when it passes through client-side encryption, and later if blind-index tokenization is built.

## Mockups

Rough wireframe mockups exist at `journal-mockups.png` in the repo root. It's a single image with 8 labeled frames; reference the specific frame(s) for whichever slice you're building rather than the whole image:

| Frame | Screen                        | Relevant slice |
| ----- | ----------------------------- | -------------- |
| 1     | Auth                          | Slice 2        |
| 2     | Home / Journals list          | Slice 3        |
| 3     | Create Journal                | Slice 3        |
| 4     | Journal detail (entries list) | Slice 4        |
| 4a    | Search/Tags filter drawer     | Slice 4        |
| 5     | New/Edit Entry                | Slice 4        |
| 5a    | New Tag modal                 | Slice 5        |
| 6     | Delete confirm modal          | Slice 6        |

These are structural references only (layout, hierarchy, what's on each screen) — not visual/style references. See Styling baseline below for actual look and feel.

## Styling baseline (placeholder — replace later)

No real design system exists yet (one is planned separately, as a shared package). Until then, use plain, boring, easily-replaceable values — the goal is consistency across slices now, not a finished look:

```css
--font-family:
  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--color-bg: #ffffff;
--color-surface: #f5f5f4;
--color-text: #1a1a1a;
--color-text-muted: #6b6b6b;
--color-border: #d4d4d4;
--color-accent: #2563eb;
--radius-sm: 6px;
--radius-md: 12px;
```

Define these once as CSS custom properties and reference them from every component's `.module.css` — don't hardcode values or invent new ones per component. When the real design system package exists, these get swapped wholesale, so keep every component consuming the variables, never a raw hex/px value.

## UX patterns

- **Delete** (both Journals and Entries): a trash icon beside each row in its list, opening a shared confirmation modal ("This can't be undone"). This is an intentionally simple interim pattern — expect it to be redesigned later, don't over-invest in it now.
- **Tags**: selected via a dropdown in the entry editor; the dropdown includes a "+ New tag" option that opens a small modal (name + color) to create one inline. A dedicated Tag Manager view is planned but deferred.
- **Autosave**: debounce entry saves (~1–2s after the user stops typing); cache the current draft in `localStorage`/`IndexedDB` on every change as a crash/close safety net; also save on tab blur (`visibilitychange`) and best-effort on `beforeunload`. Guard against a slow, stale save overwriting a newer one (cancel in-flight requests, or version/timestamp saves) — this is request sequencing on the frontend, not a job queue.

## Definition of done

Every slice must be verifiable, not just "looks done" — this is how Claude closes its own loop instead of relying on you to catch mistakes.

- **Backend**: write or update Minitest tests for new models/controllers, including at least one request spec per resource asserting cross-user access is denied (see Security above). Run `bin/ci`; it must pass before the slice is complete.
- **Frontend**: there's no test runner yet — set one up (Vitest + React Testing Library) as part of whichever slice first needs a component test, rather than deferring it further. Once it exists, write tests for new components and run them, plus `npm run build` and `npm run lint`, before the slice is complete.
- **Show the evidence**: paste the actual test output or command result confirming a pass, don't just assert "tests pass."
- Run `/code-review` on the diff after tests pass, before opening the PR.

## Ticket / test-case format

Issue bodies use two checkbox sections: **Acceptance criteria** (user-facing behavior) and **Test cases** (specific scenarios that prove it), in Given/When/Then form:

```
## Test cases
- [ ] **[Scenario name]** — Given [setup], when [action], then [expected result]
```

Test cases were written by hand per ticket (not generated by Claude) precisely so the implementation isn't graded by the same pass that wrote it.

## Workflow

- Tickets are GitHub issues, one per vertical slice, labeled `feature` — use `gh issue view <n>` / `gh issue list --label feature` for ticket context, not a separate tracker.
- Branch naming: `issue-<n>-<slug>` (e.g. `issue-4-journal-crud`), matching the issue number.
- Scope each PR to exactly one issue/slice. Don't combine multiple slices into one PR.
- Open PRs with `gh pr create --body "Closes #<n>"`.
- Run `/code-review` on the diff before pushing for review — this works locally on any plan, no GitHub App or org setup required.
- If GitHub Actions with `@claude` is connected on this repo, it uses a Claude subscription token (not a separate API key) — be mindful that automated runs share the same usage pool as interactive sessions.

## Out of scope for now (see `design-decisions.md` Feature Backlog for full list)

Entry image uploads, journal cover images, Tag Manager view, full-text search, mood/health trend charts, "on this day" view, streaks/reminders, export/backup, app-level PIN/biometric lock, the AI mood-trend message feature, personal settings.

## Guardrails

- Never hand-edit `db/schema.rb` — always generate and run a migration.
- Don't add a new gem or npm package without flagging it first.
- Entry content must never reach Rails logs or error trackers. `config/initializers/filter_parameter_logging.rb` currently filters credentials-shaped params (`:passw`, `:email`, `:secret`, `:token`, etc.) but not entry content — add `:content` (and any other entry/journal param carrying user text) to that list before entry endpoints start logging real traffic.
- Don't commit `.env` files, Rails credentials, or other secrets — use `bin/rails credentials:edit` or the deploy env vars documented under Backend.

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

Local Postgres runs in Docker (Postgres 18 — see `docker-compose.yml` at repo root), reached over TCP rather than the default domain socket:

```sh
docker compose up -d postgres   # from repo root; starts Postgres 18 on localhost:5432
```

`config/database.yml` reads connection details from `BACKEND_DATABASE_HOST`/`_PORT`/`_USERNAME`/`_PASSWORD` env vars, defaulting to `localhost:5432` / `backend` / `backend`; `docker-compose.yml` reads the same var names for its Postgres user/password, so both stay in sync if you export overrides rather than hand-editing two files.

## Frontend (`frontend/`)

React 19 + TypeScript, built with Vite. All commands below are run from `frontend/`.

```sh
npm run dev        # Vite dev server with HMR
npm run build       # tsc -b (project references, type-check only) then vite build
npm run lint        # eslint .
npm run preview     # preview a production build
```

There is no test runner configured yet — add Vitest + React Testing Library when the first component tests are needed rather than deferring indefinitely.

ESLint config (`eslint.config.js`) is flat-config based: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (Vite variant). Type-aware lint rules are not enabled (see `frontend/README.md` for how to add `tseslint.configs.recommendedTypeChecked`/`strictTypeChecked` if needed later).
