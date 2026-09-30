# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For the reasoning behind the architectural decisions below (why zero-knowledge over server-side encryption, why fields are shaped the way they are, what's deliberately deferred), see `docs/design-decisions.md`. This file is the "what to build," that one is the "why."

## Project structure

Monorepo with two projects, each with its own `CLAUDE.md` (commands and conventions) that loads when you work in that directory:

- `backend/` — Rails 8.1 API-only application (Ruby 4.0.6, PostgreSQL via `pg`, Puma).
- `frontend/` — React 19 + TypeScript app scaffolded with Vite.

Domain models, controllers, routes, and components are being built incrementally, one vertical slice per GitHub issue (see Workflow below). The data model and conventions describe the target shape — implement against them even before every piece exists yet.

## Data model

Gotchas and target shape; `backend/db/schema.rb` shows what's built so far. Models: User, Journal, Entry, Tag, TagEntries.

- **Entry has no `fk:user`** — derive via `entry.journal.user` so the two can't drift out of sync.
- **`Entry.content`/`title`/`mood`/`health`, `Journal.title`, and `Tag.content` are client-side encrypted** (see Security) — they're `string` columns holding ciphertext. `mood`/`health` are **not integers**, and there is **no DB-level range check or `CHECK`** on them: the 1–5 rating only exists in plaintext client-side, before encryption, and is validated there. Don't reintroduce an `integer` type or a `CHECK` — the app will fail to save any entry the moment that happens.
- `entry_date` is distinct from `created_at` (entries are often backdated) and stays plaintext because sorting needs it.
- Tags are scoped per user (`fk:user`), not global. `TagEntries` has a unique composite index on `(tag_id, entry_id)`.
- Journals are single-user, not collaborative. Images use Active Storage (Entry `has_many_attached`, Journal `has_one_attached` cover) — deferred, not in MVP scope.

## Security & encryption

This app uses **zero-knowledge, client-side encryption** for `Entry.content`, `Entry.title`, `Entry.mood`, `Entry.health`, `Journal.title`, and `Tag.content` — not Rails' built-in `encrypts`. The server must never receive plaintext for any of these, or the key that protects them. Plaintext stays server-side only for what functionally requires it: `entry_date` (chronological sort/backdating), `Tag.color`, foreign keys/timestamps, and `User.email` (needed for login lookup).

- On login, derive an encryption key from the user's password client-side (Web Crypto API) and hold it in memory for the session only.
- Encrypt each of the fields listed above in the browser before sending it to the server; decrypt client-side when displaying it. None of them are exceptions carved out for server-side convenience — a mood/health rating or a tag name is just as capable of leaking sensitive information as entry content is.
- There is no password reset. Losing the password means losing the data. This must be stated clearly on the Auth screen — don't let this be a silent gap.
- Search cannot use SQL (`LIKE`/`ILIKE`) against encrypted content. When search is built (post-MVP), it uses client-side blind indexing (hashed tokens generated and uploaded from the browser) — see `docs/design-decisions.md`.
- **Every backend query must be scoped to `current_user`** (e.g., `current_user.journals.find(params[:id])`, never a bare `Journal.find`). This is the standard IDOR risk and matters even more here since encryption doesn't help if authorization is broken. Backend request specs should include at least one test per resource asserting a user cannot access another user's data.

## Definition of done

Every slice must be verifiable, not just "looks done" — this is how Claude closes its own loop instead of relying on you to catch mistakes.

- **Backend**: write or update Minitest tests for new models/controllers, including at least one request spec per resource asserting cross-user access is denied (see Security above). Run `bin/ci`; it must pass before the slice is complete.
- **Frontend**: write tests for new components and run `npm run test`, plus `npm run build` and `npm run lint`, before the slice is complete (setup details in `frontend/CLAUDE.md`).
- **Show the evidence**: paste the actual test output or command result confirming a pass, don't just assert "tests pass."
- Run `/code-review` on the diff after tests pass, before opening the PR.

## Workflow

- Tickets are GitHub issues, one per vertical slice, labeled `feature` — use `gh issue view <n>` / `gh issue list --label feature` for ticket context, not a separate tracker.
- Issue bodies have **Acceptance criteria** and Given/When/Then **Test cases**, written by hand so the implementation isn't graded by the same pass that wrote it. Treat them as spec: write tests against them, and don't rewrite or weaken them to make a slice pass.
- Branch naming: `issue-<n>-<slug>` (e.g. `issue-4-journal-crud`), matching the issue number.
- Scope each PR to exactly one issue/slice. Don't combine multiple slices into one PR.
- Open PRs with `gh pr create`, using this body template (keep the `Closes #<n>` line so the issue auto-closes):

  ```
  Closes #<n>

  ## Summary
  1-5 sentences: what this PR does or what bug it fixes, and how.

  ## Changes
  - Bullet list of the main components, functions, or APIs added or changed.

  ## Follow-up notes (optional)
  - Anything that came up during this work that should be addressed in a separate PR — don't expand scope to fix it here.

  ## Manual testing
  - Steps for a human to test the PR manually

  ## Session
  Link to this Claude Code session (the `https://claude.ai/code/session_...` URL Claude Code already generates and links when it creates a PR). Omit this section only if no such link exists for how this PR was created.
  ```

- If GitHub Actions with `@claude` is connected on this repo, it uses a Claude subscription token (not a separate API key) — be mindful that automated runs share the same usage pool as interactive sessions.
- Only add comments to code if the functionality is not clear. Otherwise, do not add comments to code.

## Out of scope for now (see `docs/design-decisions.md` Feature Backlog for full list)

Entry image uploads, journal cover images, Tag Manager view, full-text search, mood/health trend charts, "on this day" view, streaks/reminders, export/backup, app-level PIN/biometric lock, the AI mood-trend message feature, personal settings.

## Guardrails

- Never hand-edit `db/schema.rb` — always generate and run a migration.
- Don't add a new gem or npm package without flagging it first.
- No encrypted field (`Entry.content`/`title`/`mood`/`health`, `Journal.title`, `Tag.content`) may reach Rails logs or error trackers. `config/initializers/filter_parameter_logging.rb` filters them today by bare key (`:content`, `:title`, `:mood`, `:health`) alongside the credentials-shaped ones. Bare keys match by name everywhere in params, so tightening them to model-scoped keys (e.g. `"entry.title"`) is a pending follow-up once the request-body shape is final — remove this note when it's done.
- Don't commit `.env` files, Rails credentials, or other secrets — use `bin/rails credentials:edit` or the deploy env vars documented in `backend/CLAUDE.md`.
- Never commit or push directly to main. Always work on a branch named after the issue (e.g. issue-4-entry-crud), and merge via PR.
