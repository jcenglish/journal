#!/usr/bin/env bash
# Creates one GitHub issue per vertical slice for the journal app.
# Run this from inside your repo, with `gh` already authenticated (gh auth login).
set -euo pipefail

if ! gh auth status &>/dev/null; then
  echo "Not authenticated with gh — run 'gh auth login' first." >&2
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Creates an issue unless one with the same title already exists (open or closed).
create_issue() {
  local title="$1"
  if gh issue list --state all --search "\"$title\" in:title" --json title \
      --jq ".[] | select(.title == \"$title\")" | grep -q .; then
    echo "Skipping (already exists): $title"
    return
  fi
  gh issue create --title "$title" --body-file "$TMP" --label feature
}

title="1. Project scaffolding: Rails API + React/TS + schema"
cat > "$TMP" <<'EOF'
## Slice
Foundational setup — not a user-facing feature, but every later slice depends on it.

## Scope
- Rails API-only app (`rails new backend --api -d postgresql`)
- React + TypeScript frontend (Vite)
- Migrations + models for User, Journal, Entry, Tag, TagEntries per the finalized schema:
  - User: password_digest (has_secure_password), email
  - Journal: title (string — holds client-side-encrypted ciphertext), fk:user
  - Entry: content, title (optional), mood, health (all four are strings holding client-side-encrypted ciphertext — **not** integers for mood/health, since the server never sees the plaintext 1-5 rating), entry_date, fk:journal — no fk:user (derive via journal.user)
  - Tag: content (string — holds client-side-encrypted ciphertext), color, fk:user (scoped per user)
  - TagEntries: fk:tag, fk:entry, unique composite index on (tag_id, entry_id)
- DB-level constraint: unique composite index on TagEntries(tag_id, entry_id). There is deliberately **no** Postgres CHECK on mood/health — they hold ciphertext, not a number, so a numeric range can't be enforced at the DB level; the 1-5 rating is validated client-side only, before encryption.
- CLAUDE.md documenting stack, conventions (TypeScript, CSS modules), and schema

## Acceptance criteria
- [ ] Both apps boot locally
- [ ] All five models + migrations exist and match the schema above
- [ ] TagEntries uniqueness enforced at the Postgres level, not just app validation
- [ ] CLAUDE.md committed

## Test cases
- [ ] **TagEntries uniqueness enforced at the DB level** — Given an existing (tag_id, entry_id) pair, when a duplicate row is inserted directly, then Postgres rejects it
EOF
create_issue "$title"

title="2. Auth + client-side key derivation"
cat > "$TMP" <<'EOF'
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
create_issue "$title"

title="3. Journal CRUD (Home + Create Journal)"
cat > "$TMP" <<'EOF'
## Slice
Create and list journals — the first full vertical slice. Journal.title is client-side encrypted, same as Entry content/title, so the Home screen must decrypt titles to render the list.

## Scope
- Home screen: list of the current user's journals — titles are decrypted client-side to render the list, since Journal.title is ciphertext server-side
- Create Journal screen: title field only (cover image deferred — see backlog). Title is encrypted client-side before it's sent to the server
- Backend: Journal create + index endpoints, scoped to current_user
- Empty state: "No journals yet — tap + to create your first one."

## Acceptance criteria
- [ ] Can create a journal and see it in the list
- [ ] Journals are scoped to the logged-in user (no cross-user access)
- [ ] Empty state renders when a user has no journals
- [ ] Journal title is unreadable directly in the database (encrypted at rest)

## Test cases
- [ ] **Create and list** — Given a logged-in user, when they submit a title, then a journal is created and appears in their Journals list (decrypted client-side)
- [ ] **Title is encrypted at rest** — Given a saved journal, when the database is queried directly, then the title column does not contain the readable title
- [ ] **Cross-user access denied** — Given two users each with a journal, when User A requests User B's journal by ID, then the response denies access, not the journal data
- [ ] **Empty state** — Given a user with zero journals, when they load Home, then the empty-state message renders instead of a blank list
- [ ] **Blank title rejected client-side** — Given the Create Journal form, when submitted with an empty title, then it's rejected before encryption/sending — there's no server-side blank check, since the server only ever sees ciphertext
EOF
create_issue "$title"

title="4. Entry CRUD with client-side encryption"
cat > "$TMP" <<'EOF'
## Slice
Create, view, and edit entries inside a journal. Content, title, mood, and health are all encrypted client-side using the key derived in slice 2.

## Scope
- Journal detail screen: entries list (paged) — titles are decrypted client-side to render the list, since Entry.title is ciphertext server-side
- Create/Edit Entry screen (same screen for both, pre-filled when editing): date, title (optional), content (TipTap Simple Editor template — text + images only, no block-based UI), mood selector (1-5), health selector (1-5)
- Content, title, mood, and health are encrypted client-side before being sent to the server; decrypted client-side when displayed. Mood/health are validated as 1-5 client-side before encryption — there's no server-side or DB-level check, since the server only ever sees ciphertext for these fields
- Backend: Entry create/show/update endpoints, scoped to current_user via journal
- Image upload is deferred — not in scope for this slice

## Acceptance criteria
- [ ] Can create, view, and edit an entry
- [ ] Entry content, title, mood, and health are all unreadable directly in the database (encrypted at rest)
- [ ] Mood/health selectors save and redisplay correctly
- [ ] Empty state: "No entries yet."

## Test cases
- [ ] **Content, title, mood, and health are encrypted at rest** — Given a saved entry, when the database is queried directly, then none of these four columns contain readable plaintext
- [ ] **Round-trip correctness** — Given a saved entry, when the same user reopens it, then all four fields decrypt and display correctly
- [ ] **Cross-user access denied** — Given User A's entry, when User B requests it by ID, then access is denied
- [ ] **Out-of-range mood/health rejected client-side** — Given the entry editor, when a mood or health value outside 1-5 is submitted (bypassing the UI selector), then the client rejects it before encrypting/sending — there is no DB-level backstop for this, since the column holds ciphertext
- [ ] **Empty state** — Given a journal with zero entries, when opened, then the empty-state message renders
EOF
create_issue "$title"

title="5. Tags: select + create inline"
cat > "$TMP" <<'EOF'
## Slice
Attach tags to entries, including creating a new tag without leaving the entry editor.

## Scope
- Tags field in the Entry editor: dropdown of existing tags (scoped to current user) + "+ New tag" option. Tag names are encrypted client-side — fetch the user's (small, per-user) tag list and decrypt client-side to populate the dropdown, rather than filtering/searching by name server-side
- New Tag modal: name + color, Cancel/Create. Name is encrypted client-side before it's sent to the server
- Backend: Tag CRUD scoped per user, TagEntries join written on save
- Dedicated Tag Manager view is deferred — see backlog

## Acceptance criteria
- [ ] Can select existing tags on an entry
- [ ] Can create a new tag from the entry editor without leaving the screen
- [ ] Tags are private to each user (not shared across accounts)
- [ ] Duplicate tagging of the same entry is prevented (unique index)
- [ ] Tag names are unreadable directly in the database (encrypted at rest)

## Test cases
- [ ] **Tags are per-user** — Given a tag owned by User A, when User B opens their own entry editor, then User A's tag does not appear in User B's dropdown
- [ ] **Inline tag creation** — Given the entry editor, when a new tag name and color are submitted from the modal, then it's created and immediately available in the dropdown without a page reload
- [ ] **Duplicate tagging rejected** — Given an entry already tagged "gratitude", when the same tag is attached again, then the duplicate is rejected
- [ ] **Tag content is encrypted at rest** — Given a saved tag, when the database is queried directly, then the content column does not contain the readable tag name
EOF
create_issue "$title"

title="6. Delete flows: entries + journals"
cat > "$TMP" <<'EOF'
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
create_issue "$title"

title="7. Autosave: debounce + local draft cache"
cat > "$TMP" <<'EOF'
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
create_issue "$title"

echo "Done — 7 issues ensured (existing ones skipped)."
