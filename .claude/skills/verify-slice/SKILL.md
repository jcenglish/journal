---
name: verify-slice
description: Run this repo's Definition of Done checklist (CLAUDE.md) against the current diff before calling a slice finished or opening a PR — runs bin/ci for backend changes and npm run build/lint (+ Vitest if configured) for frontend changes, and reports real command output.
---

# Verify slice

Use this when you believe a vertical slice is implementation-complete and are about to tell the user it's done, or about to open a PR. Do not just assert "tests pass" — this skill exists so that claim is backed by real command output pasted into the conversation.

## Steps

1. **Scope the diff.** Run `git status` and `git diff --stat` (against `main` if on a feature branch) to see which files changed. Split into backend (`backend/**`) and frontend (`frontend/**`) buckets — a slice may touch either or both.

2. **Backend changes present:**
   - From `backend/`, run `bin/ci`.
   - This runs setup → rubocop → bundler-audit → brakeman → `bin/rails test` → `db:seed:replant` in order and must fully pass — a partial run (e.g. only `bin/rails test`) does not satisfy this.
   - If it fails, stop and fix the root cause — do not report the slice as done, and do not skip failing steps.
   - Confirm request specs exist for any new/changed resource asserting cross-user access is denied (CLAUDE.md Security section) — grep the relevant `test/` files if unsure.

3. **Frontend changes present:**
   - From `frontend/`, run `npm run build` and `npm run lint`. Both must pass with no errors.
   - If a Vitest test runner exists (`frontend/vitest.config.*` or a `test` script in `package.json`), also run the test suite.
   - If new components were added and no test runner exists yet, this is the point to set one up (Vitest + React Testing Library) per CLAUDE.md — don't defer it further — then write and run tests for the new components.

4. **Paste the actual output** of whichever commands ran (or a representative tail of it for long output) into your response to the user — not a summary claiming success. This is the evidence CLAUDE.md's Definition of Done requires.

5. **Remind about `/code-review`.** CLAUDE.md requires running `/code-review` on the diff after tests pass, before opening the PR. If you haven't run it yet in this session for the current diff, say so explicitly rather than silently skipping to "ready for PR."

6. Only after all of the above hold — checks pass with real output shown, cross-user access tests exist where relevant, and `/code-review` has run — say the slice is done or proceed to open the PR.

## What this skill does not do

It does not touch git (no commits, pushes, or branch changes) and it does not open the PR itself — it only verifies. If any command fails, your job is to fix the underlying issue and re-run this checklist, not to find a way around a red step.
