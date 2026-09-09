#!/usr/bin/env bash
# Creates one GitHub issue per vertical slice for the journal app.
# Run this from inside your repo, with `gh` already authenticated (gh auth login).
set -e

gh issue create --title "1. Project scaffolding: Rails API + React/TS + schema" --body "$(cat <<'EOF'
## Slice
Foundational setup — not a user-facing feature, but every later slice depends on it.

## Scope
- Rails API-only app (`rails new backend --api -d postgresql`)
- React + TypeScript frontend (Vite)
- Migrations + models for User, Journal, Entry, Tag, TagEntries per the finalized schema:
  - User: username, password_digest (has_secure_password), email
  - Journal: title, fk:user
  - Entry: content, title (optional), mood (1-5), health (1-5), entry_date, fk:journal — no fk:user (derive via journal.user)
  - Tag: content, color, fk:user (scoped per user)
  - TagEntries: fk:tag, fk:entry, unique composite index on (tag_id, entry_id)
- DB-level CHECK constraints: mood and health between 1 and 5
- CLAUDE.md documenting stack, conventions (TypeScript, CSS modules), and schema

## Acceptance criteria
- [ ] Both apps boot locally
- [ ] All five models + migrations exist and match the schema above
- [ ] DB constraints enforced at the Postgres level, not just app validations
- [ ] CLAUDE.md committed

## Test cases
- [ ] **Mood/health CHECK enforced at the DB level** — Given a direct DB insert (bypassing app validation) with mood or health outside 1-5, when it's attempted, then Postgres rejects it
- [ ] **TagEntries uniqueness enforced at the DB level** — Given an existing (tag_id, entry_id) pair, when a duplicate row is inserted directly, then Postgres rejects it
- [ ] **Entry has no fk:user column** — Given the Entry migration, when inspected, then there is no user_id column on entries (user is derived via journal.user)
EOF
)"

gh issue create --title "2. Auth + client-side key derivation" --body "$(cat <<'EOF'
## Slice
Sign up, log in, and derive the client-side encryption key. This unlocks every later slice, since Entry content depends on it.

## Scope
- Auth screen: toggle between Log In / Sign Up, email + password fields
- has_secure_password on the backend; session-based auth
- On successful login, derive an encryption key from the password client-side (Web Crypto API) and hold it in memory for the session — the server never receives this key or the plaintext it will protect
- Visible copy on the Auth screen: a lost password means lost data, since there is no reset

## Acceptance criteria
- [ ] Can create an account and log in
- [ ] Encryption key is derived client-side on login and never sent to the server
- [ ] Password-loss warning is visible on the Auth screen
- [ ] Logging out clears the key from memory

## Test cases
- [ ] **Signup creates an account** — Given a new email and password, when signup is submitted, then an account is created and a session starts
- [ ] **Login rejects bad credentials** — Given an existing account, when login is attempted with the wrong password, then it's rejected and no session is created
- [ ] **Key never leaves the client** — Given a successful login, when the network requests are inspected, then no request body or response contains the derived encryption key
- [ ] **Logout clears the key** — Given a logged-in session with a derived key, when the user logs out, then the key is no longer available in memory (a subsequent decrypt attempt fails without re-login)
EOF
)"

gh issue create --title "3. Journal CRUD (Home + Create Journal)" --body "$(cat <<'EOF'
## Slice
Create and list journals — the first full vertical slice. No encryption needed since a journal only has a title.

## Scope
- Home screen: list of the current user's journals
- Create Journal screen: title field only (cover image deferred — see backlog)
- Backend: Journal create + index endpoints, scoped to current_user
- Empty state: "No journals yet — tap + to create your first one."

## Acceptance criteria
- [ ] Can create a journal and see it in the list
- [ ] Journals are scoped to the logged-in user (no cross-user access)
- [ ] Empty state renders when a user has no journals

## Test cases
- [ ] **Create and list** — Given a logged-in user, when they submit a title, then a journal is created and appears in their Journals list
- [ ] **Cross-user access denied** — Given two users each with a journal, when User A requests User B's journal by ID, then the response denies access, not the journal data
- [ ] **Empty state** — Given a user with zero journals, when they load Home, then the empty-state message renders instead of a blank list
- [ ] **Blank title rejected** — Given the Create Journal form, when submitted with an empty title, then it's rejected with a validation error
EOF
)"

gh issue create --title "4. Entry CRUD with client-side encryption" --body "$(cat <<'EOF'
## Slice
Create, view, and edit entries inside a journal. Content is encrypted client-side using the key derived in slice 2.

## Scope
- Journal detail screen: entries list (paged)
- Create/Edit Entry screen (same screen for both, pre-filled when editing): date, title (optional), content (TipTap Simple Editor template — text + images only, no block-based UI), mood selector (1-5), health selector (1-5)
- Content is encrypted client-side before it's sent to the server; decrypted client-side when displayed
- Backend: Entry create/show/update endpoints, scoped to current_user via journal
- Image upload is deferred — not in scope for this slice

## Acceptance criteria
- [ ] Can create, view, and edit an entry
- [ ] Entry content is unreadable directly in the database (encrypted at rest)
- [ ] Mood/health selectors save and redisplay correctly
- [ ] Empty state: "No entries yet."

## Test cases
- [ ] **Content is encrypted at rest** — Given a saved entry, when the database is queried directly, then the content column does not contain readable plaintext
- [ ] **Round-trip correctness** — Given a saved entry, when the same user reopens it, then the content decrypts and displays correctly
- [ ] **Cross-user access denied** — Given User A's entry, when User B requests it by ID, then access is denied
- [ ] **Mood/health range enforced at the DB level** — Given a mood or health value outside 1-5, when saved (even bypassing app validation), then the database rejects it
- [ ] **Empty state** — Given a journal with zero entries, when opened, then the empty-state message renders
EOF
)"

gh issue create --title "5. Tags: select + create inline" --body "$(cat <<'EOF'
## Slice
Attach tags to entries, including creating a new tag without leaving the entry editor.

## Scope
- Tags field in the Entry editor: dropdown of existing tags (scoped to current user) + "+ New tag" option
- New Tag modal: name + color, Cancel/Create
- Backend: Tag CRUD scoped per user, TagEntries join written on save
- Dedicated Tag Manager view is deferred — see backlog

## Acceptance criteria
- [ ] Can select existing tags on an entry
- [ ] Can create a new tag from the entry editor without leaving the screen
- [ ] Tags are private to each user (not shared across accounts)
- [ ] Duplicate tagging of the same entry is prevented (unique index)

## Test cases
- [ ] **Tags are per-user** — Given a tag owned by User A, when User B opens their own entry editor, then User A's tag does not appear in User B's dropdown
- [ ] **Inline tag creation** — Given the entry editor, when a new tag name and color are submitted from the modal, then it's created and immediately available in the dropdown without a page reload
- [ ] **Duplicate tagging rejected** — Given an entry already tagged "gratitude", when the same tag is attached again, then the duplicate is rejected
EOF
)"

gh issue create --title "6. Delete flows: entries + journals" --body "$(cat <<'EOF'
## Slice
Delete journals and entries via a trash icon and a shared confirm modal.

## Scope
- Trash icon beside each row in the Journals list and the Entries list
- Shared Delete Confirm modal ("This can't be undone") used for both
- Deleting a journal cascades to its entries and their tag associations
- This is an interim UX pattern — expected to be redesigned later (see decision log)

## Acceptance criteria
- [ ] Tapping trash opens the confirm modal; confirming removes the row
- [ ] Deleting a journal removes all of its entries
- [ ] Canceling leaves everything unchanged

## Test cases
- [ ] **Cascade delete** — Given a journal with entries and tagged entries, when the journal is deleted and confirmed, then its entries and their TagEntries rows are also removed
- [ ] **Cancel is a no-op** — Given the confirm modal is open, when "Cancel" is tapped, then nothing is deleted and the modal closes
- [ ] **Cross-user delete denied** — Given User A's entry, when User B sends a delete request for it directly via the API, then access is denied
EOF
)"

gh issue create --title "7. Autosave: debounce + local draft cache" --body "$(cat <<'EOF'
## Slice
Protect entry content against a crashed tab or accidental close while writing.

## Scope
- Debounced save (~1-2s after the user stops typing)
- Local draft cached in localStorage/IndexedDB on every change
- Save triggers on tab blur (visibilitychange) and best-effort on beforeunload
- Request sequencing so a slow, stale save can't overwrite a newer one

## Acceptance criteria
- [ ] Closing the tab mid-edit and reopening restores the unsaved draft
- [ ] No duplicate or out-of-order saves under normal use
- [ ] Local draft clears once the server confirms the save

## Test cases
- [ ] **Draft restored after close** — Given an in-progress edit, when the tab is closed and reopened before the debounce fires, then the local draft is restored
- [ ] **Stale save doesn't win** — Given two saves fire close together, when the older request resolves after the newer one, then the newer content is not overwritten
- [ ] **Draft clears on confirmed save** — Given a successful server save, when it confirms, then the local draft cache is cleared
EOF
)"

echo "Done — 7 issues created."