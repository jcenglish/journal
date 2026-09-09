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
- **Status:** Decided

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

- **Mood/health trend charts** — line chart over existing mood/health ratings on Entry.
- **"On this day" view** — surface entries from a year/month ago on today's date.
- **Search/filter entries by tag** — Tag + TagEntries already support this; mostly a UI addition.
- **Streaks/reminders** — consecutive-day tracking plus a daily nudge notification.

### Differentiators, fit the zero-knowledge direction

- **Export/backup** — client-side decrypt-and-download of entries (JSON/Markdown). Also doubles as a partial mitigation for "lost my key."
- **App-level lock** — PIN/biometric on top of login, auto-lock after inactivity.
- **Multiple journals per user** — schema (Journal as its own table) already supports this; mainly a UI addition.

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
