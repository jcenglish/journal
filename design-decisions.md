# Journal App — Design Decision Log

A running record of technical decisions, why they were made, and what was considered instead. Add a new entry any time a real decision gets made — the point is future-me remembering the _reasoning_, not just the outcome.

---

## Decisions

### 2026-09-05 — Tech stack: React/TypeScript + Rails (API-only) + PostgreSQL

- **Decision:** React/TS frontend, Rails API-only backend, Postgres.
- **Context:** Classic CRUD app, low complexity by design, so the project can focus on clean fundamentals rather than framework fights.
- **Alternatives considered:** N/A — chosen up front as the deliberate constraint for this project.
- **Status:** Decided

### 2026-09-05 — Images handled via Rails Active Storage, not a custom Image table

- **Decision:** Drop the hand-rolled `Image` table; use `has_many_attached` on Entry and `has_one_attached` on Journal (cover image).
- **Context:** A custom Image table raises questions about reuse across entries/journals, orphan cleanup, and storage backend — Active Storage solves all of this for free.
- **Alternatives considered:** Custom `Image` model with `fk:entry`, images scoped to a single entry only.
- **Status:** Decided
- **Update (2026-09-06):** Image upload UI (entry images and journal cover images) deferred from MVP frontend scope. Schema/backend decision stands — just not being built into the first pass of views.

### 2026-09-05 — Journal is single-user (no collaboration)

- **Decision:** `Journal` keeps a single `fk:user`. No join table for multiple users per journal.
- **Context:** This is a personal journal, not a collaborative tool — multi-user support would add real complexity for a feature that isn't needed.
- **Alternatives considered:** Join table (`JournalUsers`) for shared journals.
- **Status:** Decided

### 2026-09-05 — Encryption: zero-knowledge (client-side), not server-side field encryption

- **Decision:** Encrypt entry content client-side, with the key derived from the user's password. The server never sees plaintext or holds a usable key.
- **Context:** Chosen deliberately as a professional differentiator — client-side key derivation, correct Web Crypto API usage, and a real threat-modeling story are stronger portfolio/interview material than a CRUD app alone. Real-world precedent: Standard Notes and Day One both ship this; Day One's inability to retrofit it onto existing journals without manual copying is a cautionary example of why this needed deciding early rather than bolted on later.
- **Trade-off accepted:** Meaningfully more upfront complexity than the project's original "low complexity, focus on fundamentals" goal. Password reset has no safety net — losing the password means losing the data unless a recovery/escrow mechanism is built. Search cannot use SQL directly (see next entry).
- **Alternatives considered:** Rails built-in `encrypts` (server-side field encryption) — simpler, retrofittable later, but the server can technically read entries. No encryption at all.
- **Status:** Decided

### 2026-09-05 — Search: client-side blind indexing, built after the client-side crypto layer exists

- **Decision:** Search will use blind indexing (hashed tokens uploaded alongside encrypted content), generated client-side. Not required for v1.
- **Context:** With zero-knowledge encryption, the server can't tokenize content for search since it never has the key — indexing has to happen in the browser, most practically as a one-time step per entry the next time a user logs in.
- **Prerequisite:** The client-side crypto layer (key derivation + encrypt/decrypt via Web Crypto API) must exist before this is buildable. That layer, not the search feature, is the actual milestone to hit early.
- **Alternatives considered:** Decrypt-and-filter in Ruby (only viable with server-side encryption, not zero-knowledge). Deterministic encryption (exact-match only, not useful for keyword search).
- **Status:** Decided (deferred to post-v1)

### 2026-09-05 — Entry drops its own fk:user; user is derived via Entry → Journal → User

- **Decision:** Remove `fk:user` from Entry. A user is reached via `entry.journal.user`.
- **Context:** Resolves the redundancy — the field duplicated Journal's user and created a place for the two to drift out of sync. Chosen over the denormalization option since it's simpler and this project favors low complexity.
- **Alternatives considered:** Keep `fk:user` on Entry as an intentional denormalization, with a validation enforcing `entry.user == entry.journal.user`.
- **Status:** Decided

### 2026-09-05 — Tag is scoped per-user

- **Decision:** Add `fk:user` to Tag. Tags are private to each user, not shared globally.
- **Context:** Without this, two users would share one tag namespace and color palette — doesn't make sense for a personal journal.
- **Alternatives considered:** Global tags shared across all users.
- **Status:** Decided

### 2026-09-05 — Add entry_date, separate from created_at

- **Decision:** Entry gets an explicit `entry_date` field distinct from the `created_at` timestamp.
- **Context:** Journal entries are often written after the fact (backdating) — `entry_date` captures "when it happened," `created_at` captures "when it was written."
- **Alternatives considered:** Rely on `created_at` only.
- **Status:** Decided

### 2026-09-05 — DB-level constraints: mood/health CHECK, TagEntries unique index

- **Decision:** Add a Postgres CHECK constraint enforcing `mood` and `health` are between 1 and 5. Add a unique composite index on `TagEntries(tag_id, entry_id)`.
- **Context:** App-level validations alone don't stop bad data from entering the database directly — DB constraints are the actual guarantee. The unique index prevents duplicate taggings of the same entry.
- **Alternatives considered:** App-level validation only.
- **Status:** Superseded (2026-09-10) — the mood/health CHECK no longer applies now that both columns are encrypted (`string`, not `integer`); see the 2026-09-10 encryption-scope entry below. The TagEntries unique index is unaffected and still stands.

### 2026-09-06 — Autosave: debounced save + local draft cache

- **Decision:** Debounce entry saves (fire after ~1–2s of inactivity), with a local draft cached in `localStorage`/`IndexedDB` on every change as a crash/disruption safety net. Also save on tab blur (`visibilitychange`) and best-effort on `beforeunload`.
- **Context:** Standard pattern used by Google Docs, Notion, and most editors — protects against a crashed tab or accidental close without needing a background job system. Debounce beats fixed intervals or character-count triggers because it saves right when the user naturally pauses rather than on an arbitrary schedule.
- **Caveat:** The local draft cache holds plaintext before client-side encryption. This is a different, narrower threat model (physical access to an unlocked device) than the zero-knowledge "server sees nothing" goal — accepted as a conscious tradeoff, not an oversight.
- **Caveat:** Needs request sequencing on the frontend (cancel in-flight saves, or version/timestamp each save) so a slow, stale save can't overwrite a newer one. This is not a job queue — no Sidekiq/Redis needed; that pattern solves background processing, a different problem.
- **Alternatives considered:** Fixed-interval autosave, character-count-triggered autosave, full operational-transform/CRDT queue (only needed for collaborative multi-user editors, not applicable to a single-user journal).
- **Status:** Decided

### 2026-09-06 — Entry editor: BlockNote

- **Decision:** Use BlockNote for the entry content editor.
- **Context:** Closest match to the desired Notion-style block editing UX — React + TypeScript native, built on ProseMirror/TipTap, ships with a slash-menu, drag-and-drop blocks, and nesting out of the box.
- **Caveat:** Content is stored as BlockNote's JSON block structure, not raw markdown text. Worth confirming this serializes cleanly for client-side encryption (encrypt the JSON blob) and for the future blind-indexing step (tokenize from the block JSON, not assumed plain text).
- **Alternatives considered:** TipTap directly (more control, no pre-built UI), Milkdown (markdown-text-first rather than block-based JSON).
- **Status:** Superseded — see 2026-09-08 entry below.

### 2026-09-06 — MVP views: add Create Journal

- **Decision:** Add a Create Journal view — a form with a title field — to the MVP view list.
- **Context:** Flagged during a review of the planned MVP frontend views — Journals list and Journal detail existed, but nothing to actually create one.
- **Status:** Decided

### 2026-09-06 — Tag selection & creation UX

- **Decision:** In the Create/Edit Entry view, tags are selected from a dropdown; the dropdown includes an option to open a modal for creating a new tag (name + color) inline.
- **Context:** A dedicated Tag Manager view (for renaming/deleting/recoloring tags outside the entry editor) is planned but deferred — dropdown + inline-create modal covers the MVP need.
- **Alternatives considered:** Building the full Tag Manager view now.
- **Status:** Decided (Tag Manager view deferred — see Feature Backlog)

### 2026-09-06 — Delete UX for Entries and Journals (interim)

- **Decision:** In both the Entries list and Journals list, a delete icon sits beside each row's title/date. Tapping it opens a confirmation modal before deleting.
- **Context:** Simplest pattern to ship for MVP; explicitly a placeholder — a more considered delete UX (e.g., swipe-to-delete, undo toast) is expected to replace this later.
- **Status:** Decided (interim — expect to revisit)

### 2026-09-08 — Entry editor: switched to TipTap's Simple Editor template (supersedes BlockNote)

- **Decision:** Use TipTap directly via its official open-source "Simple Editor" template (`npx @tiptap/cli add simple-editor`) instead of BlockNote.
- **Context:** Actual content need is just text + images, not full block-based editing (tables, embeds, nested blocks, drag-and-drop). BlockNote's Notion-style block model was more than the app needs. Looked at what Bear (a comparable journaling-adjacent app) does for inspiration — Bear is proprietary native software with no public library behind it, but the pattern it uses (a continuous flowing document with inline WYSIWYG formatting, not discrete draggable blocks) is closer to the target feel than Notion's block model.
- **What it gives**: bold/italic/underline, lists, headings, text alignment, image upload, link editing, undo/redo — MIT licensed, React-native, unstyled enough to skin with CSS Modules.
- **Still true from the original decision**: content still serializes to a JSON doc (ProseMirror format, same family as BlockNote's), so the same encryption and future blind-indexing considerations still apply — just a smaller document shape than BlockNote's block tree.
- **Alternatives considered:** Keep BlockNote (rejected — more surface area than needed). Milkdown (markdown-text-first, an even closer conceptual match to Bear, but a less mature ecosystem for this use case).
- **Status:** Decided

### 2026-09-10 — Entry.title is client-side encrypted too, not just content

- **Decision:** `Entry.title` is encrypted client-side with the same key as `content`, not stored as plaintext.
- **Context:** Title is optional free text the user writes (e.g. "Therapy notes — divorce") and is just as capable of leaking sensitive information as `content`. The original zero-knowledge decision only named `content` explicitly; this closes that gap rather than leaving title as an unintentional plaintext exception to an otherwise zero-knowledge design.
- **Trade-off accepted:** Title can no longer be sorted, filtered, or previewed server-side (e.g. in an admin view or a lightweight list endpoint) — the same limitation `content` already has. Entries lists must decrypt client-side to show titles.
- **Alternatives considered:** Leave title as plaintext for server-side convenience (rejected — undermines the zero-knowledge claim for a field that carries the same risk profile as content).
- **Status:** Decided

### 2026-09-10 — Encryption scope extended to Journal.title, Entry.mood/health, and Tag.content

- **Decision:** `Journal.title`, `Entry.mood`, `Entry.health`, and `Tag.content` (the tag name) are all client-side encrypted with the same key as `Entry.content`/`Entry.title`. Plaintext fields remaining server-side: `entry_date`, `Tag.color`, all foreign keys and timestamps, `User.email`.
- **Context:** A field-by-field review turned up an internal contradiction: the "AI-generated mood trend message" backlog entry already assumed "mood is already decrypted client-side to render entries," while the schema and the "Mood/health trend charts" backlog entry assumed the opposite — plaintext mood/health queryable server-side. Mood/health ratings are health-adjacent data and just as sensitive as entry content; leaving them plaintext meant a DB compromise could chart a user's mood/health history without ever touching content. Journal.title carries the identical risk already accepted for Entry.title (a user-chosen label like "Divorce planning" or "Therapy"). Tag.content is short, categorical, and arguably more scannable in bulk than a title ("therapy", "grief", "job search").
- **Trade-off accepted:** None of these can be queried, sorted, or aggregated server-side anymore. Concretely: the Home screen decrypts journal titles client-side to render the list; mood/health trend charts (backlog) must be computed client-side over already-decrypted entries rather than via a server-side SQL aggregate — still cheap, just moves the math into JS. Tag dropdown and tag-based filtering fetch the user's (small, per-user) tag list and decrypt client-side rather than filtering via SQL — see Feature Backlog updates below. `mood` and `health` change column type from `integer` to `string` (they now hold ciphertext, not a number), which makes the Postgres `CHECK (mood BETWEEN 1 AND 5)` from the 2026-09-05 entry impossible to keep — a range check can't apply to an opaque encrypted string. This isn't a weakened version of that guarantee, it's the same posture `content`/`title` already have (no DB-level format validation at all); range validation becomes client-side only, before encryption.
- **Alternatives considered:** Leave mood/health plaintext to keep trend-chart aggregation server-side (rejected — the whole point of zero-knowledge is that health-adjacent ratings shouldn't be readable without the key any more than content should). Leave Tag.content plaintext since tag lists are small (rejected — small doesn't mean non-sensitive; a plaintext tag vocabulary alone can reveal a user's life circumstances without decrypting a single entry).
- **Status:** Decided

### 2026-09-10 — Auth: split-key derivation, so the server never sees the password

- **Decision:** The password never leaves the browser. One PBKDF2-HMAC-SHA256 pass (600,000 iterations) turns it into a master key, which HKDF-SHA256 splits — using distinct `info` labels — into a wrapping key that stays in memory and a base64 `authHash` that is POSTed as the `password` param and bcrypt'd by `has_secure_password`. The server stores only `bcrypt(authHash)`.
- **Context:** The password has two jobs: prove identity, and produce the AES key. Doing both with the same transmitted value satisfies the letter of "the key is never sent" while gutting the spirit of it — the server would receive the *seed* of the key, sitting in the params hash, in Puma's memory, in any APM trace or heap dump. Anyone holding it re-runs the same PBKDF2 and reads every entry. HKDF is one-way, so possession of `authHash` yields nothing about the wrapping key; recovering the password from it costs the same 600k-iteration brute force as attacking the digest directly. Precedent: Bitwarden and Standard Notes (v004) both ship this shape.
- **Trade-off accepted:** Any server-side password strength validation becomes meaningless — the server only ever sees 44 characters. Minimum length is enforced client-side only (`AuthPage`), and deliberately *not* mirrored as a Rails validation that would be a lie passing 100% of the time.
- **Stated boundary:** This does not defend against a hostile server shipping malicious JavaScript. Every web-delivered E2EE system shares that hole. What it does defend against: server-side logging, database compromise, a curious operator, an APM vendor, and a subpoena of data at rest.
- **Alternatives considered:** POST the real password over TLS and derive the key separately from it (rejected — the server momentarily holds material that re-derives the key). Bitwarden's original 1-iteration-PBKDF2 auth hash (HKDF with domain-separated labels is cleaner).
- **Status:** Decided

### 2026-09-10 — KDF salt is the normalized email, not a random per-user column

- **Decision:** `salt = "journal:v1:" + email.trim().toLowerCase()`. No salt column, no pre-login lookup.
- **Context:** PBKDF2 has to run *before* authentication — the derived value **is** the credential — so the client needs the salt with no session to authorize a fetch. A random salt lives in the database and would need an unauthenticated `GET /api/salt?email=`, which answers "does an account exist here?" to anyone who asks. On a private journal, membership is itself sensitive. Salts need uniqueness, not secrecy or entropy, and the email is already the unique index on `users`. The `journal:v1:` prefix scopes it so no precomputation is reusable against another service.
- **Trade-off accepted:** The salt is predictable, so someone targeting a known person can precompute before ever breaching the database. Blunted by the 600k iteration count (each candidate password is expensive), the app-scoping prefix, and the fact that the work still helps against only that one target rather than being amortized across all users.
- **Hard constraint this creates:** the client must normalize the email **identically** to `User.normalizes`. A mismatch authenticates fine but derives a different key — silent, unrecoverable data loss in an app with no reset. Pinned by a test in `crypto.test.ts`.
- **Alternatives considered:** Random `key_derivation_salt` column plus a prelogin endpoint (rejected — enumeration oracle, and Bitwarden's own mitigation for it is to return a *deterministic fake* salt for unknown emails, which means building this scheme anyway as a fallback path).
- **Status:** Decided

### 2026-09-10 — Signup still discloses account existence (known, bounded, not closed)

- **Decision:** Login is carefully non-disclosing (identical body *and*, via `authenticate_by`, identical timing for an unknown email and a wrong password). Signup is not: a duplicate address returns `422 {"errors":["Email has already been taken"]}`. It is rate limited to 10 attempts per 3 minutes, and otherwise accepted as a known gap.
- **Context:** Caught in review as an inconsistency — the salt decision above rejected a prelogin endpoint precisely to avoid an enumeration oracle, and signup hands over the same fact. Genuinely closing it means accepting every signup, disclosing nothing, and confirming out of band by email, which needs a mailer and an email-verification flow that MVP doesn't have. Rate limiting bounds how fast the oracle can be walked; it does not remove it.
- **Trade-off accepted:** An attacker can still test whether a specific address has an account, at ~10 guesses per 3 minutes per IP. Bulk enumeration is impractical; targeted confirmation is not.
- **Revisit when:** email verification exists, or if this app ever holds accounts where membership alone is the sensitive fact.
- **Status:** Decided (known limitation — deliberately not closed in MVP)

### 2026-09-10 — Key hierarchy: a random data key, wrapped by the password-derived key

- **Decision:** At signup the browser generates a random 256-bit data key, wraps it with the password-derived wrapping key (AES-GCM), and stores the result server-side as the opaque `users.encrypted_data_key`. The data key — not the password-derived key — encrypts entries, titles, and tags. Login fetches the blob and unwraps it in the browser.
- **Context:** Deriving the content key directly from the password welds the two together: a password change, an email change (see the salt entry above), or raising the iteration count would each require re-encrypting every row, driven from the browser, per user, on next login. That is precisely the Day One retrofit problem already cited as the reason to decide this early. With the indirection, all three become a re-wrap of one value.
- **Trade-off accepted:** One more column, one more field on the signup request and the login response, and ~25 lines of client crypto. `encrypted_data_key` is validated for presence so an omission is a 422 rather than a NOT NULL 500.
- **Envelope format (frozen from here):** `base64([version:1][iv:12][ciphertext+tag])`, a fresh 96-bit IV per message, and the version byte passed as AES-GCM **associated data** so it's covered by the authentication tag. Binding it costs nothing while only one version exists; without it, a tampering server could later downgrade a v2 blob to v1 undetectably. The same envelope wraps the data key and every encrypted field.
- **Note:** No `kdf_version` column. The client must choose KDF params at step one, before authenticating, so a column can't be read in time without reintroducing the enumeration endpoint. The version lives in a hardcoded client constant and in the HKDF `info` labels; a future v2 tries v2, falls back to v1 on 401, then re-wraps.
- **Alternatives considered:** Derive the content key straight from the password (rejected — expensive to reverse, cheap to prevent).
- **Status:** Decided

### 2026-09-10 — Session: cookie store, not a Session table; Vite proxy, not CORS

- **Decision:** `api_only` strips cookies and sessions from the middleware stack; both are added back in `config/application.rb` at the same positions the non-api stack uses. Auth state is `session[:user_id]` in an HttpOnly, SameSite=Lax cookie signed by `secret_key_base`. In development a Vite proxy (`/api` → `localhost:3000`) keeps the browser on one origin. Rails owns the `/api` prefix, so the dev proxy and any production edge proxy stay the same rule and can't drift.
- **Context:** A `Session` table isn't in the data model, and what it buys — server-side revocation, "log out all devices", idle expiry — is unasked-for here. `rack-cors` with `credentials: true` would require `SameSite=None; Secure`, meaning HTTPS in dev, and `SameSite=None` is exactly the attribute that re-enables cross-site cookie sending. The proxy avoids the gem entirely.
- **Trade-off accepted:** No server-side revocation. A stolen cookie stays valid until `secret_key_base` rotates. Acceptable for a single-user journal over HTTPS with HttpOnly; a `Session` table is the fix if that ever stops being true.
- **Gotcha worth remembering:** `bin/setup` clears `tmp/`, regenerating `tmp/local_secret.txt` and invalidating the dev session — so running `bin/ci` looks like it logged you out.
- **Status:** Decided

### 2026-09-10 — CSRF: layered controls rather than a synchronizer token

- **Decision:** `ActionController::API` has no `RequestForgeryProtection`, and it is not added back. Three independent controls instead: **SameSite=Lax** on the session cookie (suppresses it on cross-site subrequests and non-GET navigations — every write here is POST or DELETE); **no CORS allowance at all** (cross-origin JS can't read responses, and a JSON content type triggers a preflight that fails); and a **JSON-only body requirement** (a cross-site HTML form — the only way to make a cross-origin write without CORS — can only send urlencoded, multipart, or text/plain).
- **Context:** A token means shipping it to the client via a readable cookie or a dedicated endpoint, for a defense that SameSite already provides given a same-origin deployment.
- **Stated collapse condition:** *this posture rests on frontend and API sharing one origin in production.* A split-origin deploy forces `SameSite=None`, which voids control #1 and makes a double-submit CSRF token mandatory. Decide that before deploying, not after.
- **Status:** Decided

### 2026-09-10 — Request bodies are explicitly nested under a resource key

- **Decision:** `wrap_parameters format: []` disables ParamsWrapper's implicit wrapping. Every request body nests explicitly: `{"user": {…}}`, `{"session": {…}}`, later `{"entry": {…}}`.
- **Context:** Left on, ParamsWrapper would find no `Registration` model for `RegistrationsController`, fall through to nil, and wrap *all* params under a `registration` key anyway — leaving both flat and wrapped copies in `params` and in the logs.
- **Why it matters beyond tidiness:** this is the precondition CLAUDE.md's guardrail names for tightening `filter_parameter_logging`'s bare `:title`/`:content`/`:mood`/`:health` keys into dotted, model-scoped ones (`"entry.title"`) in slice 4. A flat body shape would have made that guardrail unimplementable.
- **Status:** Decided

### 2026-09-10 — A page reload ends the session rather than offering an unlock screen

- **Decision:** The session cookie survives a reload but the in-memory key does not. On mount, if the keystore is empty, the client fires `DELETE /api/session` and shows the Auth screen. Two states, not three.
- **Context:** The alternative — keep the session and prompt for the password to re-derive the key — is nicer UX but means every later slice has to handle an "authenticated but locked" state, and it really wants a server-side idle timeout to go with it.
- **Trade-off accepted:** A refresh logs you out, which is mildly annoying in development. The unlock screen is a purely additive change later: same components, same endpoints.
- **Status:** Decided (interim — expect to revisit alongside the app-level lock in the backlog)

---

## Open Questions

None currently open — the four questions from the initial schema pass were resolved above.

---

## Feature Backlog

Captured ideas, not commitments. Won't build all of these — keeping them written down so the reasoning isn't lost. Promote an item to a full Decision entry above once it's actually built.

### Deferred from MVP (already decided, just not built yet)

- **Entry image uploads** — Active Storage decision stands; upload UI deferred from the first frontend pass.
- **Journal cover images** — same as above.
- **Tag Manager view** — dedicated view for renaming/deleting/recoloring tags outside the entry editor; MVP uses dropdown + inline-create modal instead (see Decisions).

### Low-effort, fits current schema

- **"On this day" view** — surface entries from a year/month ago on today's date.
- **Streaks/reminders** — consecutive-day tracking plus a daily nudge notification.

### Differentiators, fit the zero-knowledge direction

- **Export/backup** — client-side decrypt-and-download of entries (JSON/Markdown). Also doubles as a partial mitigation for "lost my key."
- **App-level lock** — PIN/biometric on top of login, auto-lock after inactivity.
- **Multiple journals per user** — schema (Journal as its own table) already supports this; mainly a UI addition.
- **Mood/health trend charts** — now that mood/health are encrypted, this is a client-side rolling-average calc over already-decrypted entries rather than a server-side SQL aggregate (same "detection is free, already decrypted" reasoning as the AI mood trend idea below).
- **Search/filter entries by tag** — Tag content is now encrypted, so this is client-side filtering over the user's decrypted tag list (small, per-user — no blind indexing needed) rather than a server-side SQL join.

### Conflicts with zero-knowledge — decide consciously before building

- **Location/weather auto-tagging on entries** — requires sending metadata to a server, which cuts against the "server sees nothing" premise.
- **Full-text search across all entries** — already resolved via blind indexing (see Decisions above); same tradeoff, not a new one.

### Idea: AI-generated mood trend message

- **Concept:** after enough entries, if mood is trending in a direction, show an encouraging/mindful message.
- **Key insight:** trend _detection_ and message _generation_ are separable — only one threatens zero-knowledge.
  - **Detection:** mood is already decrypted client-side to render entries. A rule-based trend calc (rolling average, threshold) runs entirely in the browser. Zero privacy cost, no AI needed.
  - **Message generation — three tiers:**
    1. _Canned messages_ — pick from a pre-written bank keyed to trend direction. No AI, nothing leaves the device, zero privacy cost.
    2. _Minimal AI_ — send only mood numbers (no entry text) to an LLM API for a more natural message. Small, bounded leak of numeric data only.
    3. _Full AI_ — send entry content to an LLM for a contextual message. Genuinely compromises zero-knowledge; a third party sees plaintext.
  - _Advanced alternative to tier 3:_ on-device/local LLM inference to keep full privacy — a real jump in complexity, likely out of scope.
- **Leaning:** tier 1 first (ships the feature with no privacy compromise); tiers 2–3 as optional, clearly-disclosed upgrades later.
- **Status:** Idea — undecided which tier, if any.

---

## Template for new entries

```
### YYYY-MM-DD — [Decision title]
- **Decision:**
- **Context:**
- **Alternatives considered:**
- **Status:** Decided / Open / Revisited
```
