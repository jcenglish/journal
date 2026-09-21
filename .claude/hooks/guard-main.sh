#!/usr/bin/env bash
# Claude Code PreToolUse hook — blocks git commands that would write directly
# to main, or that are destructive/hard-to-reverse regardless of branch.
# Place at .claude/hooks/guard-main.sh and chmod +x it.

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

is_commit=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git commit' && is_commit=true

is_push=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git push' && is_push=true

targets_main=false
echo "$command" | grep -Eq '\bmain\b' && targets_main=true

is_force_push=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git push\b[^;&|]*(--force\b|--force-with-lease\b|\s-f\b)' && is_force_push=true

is_hard_reset=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git reset\b[^;&|]*--hard\b' && is_hard_reset=true

is_force_clean=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git clean\b[^;&|]*-[a-zA-Z]*f' && is_force_clean=true

is_force_branch_delete=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git branch\b[^;&|]*-D\b' && is_force_branch_delete=true

no_verify=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git (commit|push)\b[^;&|]*(--no-verify|-n\b)' && no_verify=true

current_branch=$(git branch --show-current 2>/dev/null)
on_main=false
[ "$current_branch" = "main" ] && on_main=true

if $is_commit && $on_main; then
  echo '{"decision": "block", "reason": "Direct commits to main are blocked. Create a branch first (e.g. git checkout -b issue-4-entry-crud), per CLAUDE.md Guardrails."}'
elif $is_push && { $targets_main || $on_main; }; then
  echo '{"decision": "block", "reason": "Direct pushes to main are blocked. Create a branch and open a PR instead, per CLAUDE.md Guardrails."}'
elif $no_verify; then
  echo '{"decision": "block", "reason": "This skips git hooks (--no-verify/-n). Never skip hooks unless the user has explicitly asked for it, per the Git Safety Protocol."}'
elif $is_force_push; then
  echo '{"decision": "block", "reason": "Force-pushing can overwrite remote history. Confirm with the user before doing this, per the Git Safety Protocol."}'
elif $is_hard_reset; then
  echo '{"decision": "block", "reason": "git reset --hard discards uncommitted work irreversibly. Confirm with the user before doing this, per the Git Safety Protocol."}'
elif $is_force_clean; then
  echo '{"decision": "block", "reason": "git clean -f permanently deletes untracked files. Confirm with the user before doing this, per the Git Safety Protocol."}'
elif $is_force_branch_delete; then
  echo '{"decision": "block", "reason": "git branch -D force-deletes a branch even with unmerged work. Confirm with the user before doing this, per the Git Safety Protocol."}'
else
  echo '{}'
fi
