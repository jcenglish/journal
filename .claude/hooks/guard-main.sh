#!/usr/bin/env bash
# Claude Code PreToolUse hook — blocks git commit or git push commands that
# would write directly to main.
# Place at .claude/hooks/guard-main.sh and chmod +x it.

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

is_commit=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git commit' && is_commit=true

is_push=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git push' && is_push=true

targets_main=false
echo "$command" | grep -Eq '\bmain\b' && targets_main=true

current_branch=$(git branch --show-current 2>/dev/null)
on_main=false
[ "$current_branch" = "main" ] && on_main=true

if $is_commit && $on_main; then
  echo '{"decision": "block", "reason": "Direct commits to main are blocked. Create a branch first (e.g. git checkout -b issue-4-entry-crud), per CLAUDE.md Guardrails."}'
elif $is_push && { $targets_main || $on_main; }; then
  echo '{"decision": "block", "reason": "Direct pushes to main are blocked. Create a branch and open a PR instead, per CLAUDE.md Guardrails."}'
else
  echo '{}'
fi