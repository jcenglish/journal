#!/usr/bin/env bash
# Claude Code PreToolUse hook — blocks any Bash command that would push to main.

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

is_push=false
echo "$command" | grep -Eq '(^|;|&&|\|)\s*git push' && is_push=true

targets_main=false
echo "$command" | grep -Eq '\bmain\b' && targets_main=true

current_branch=$(git branch --show-current 2>/dev/null)

if $is_push && { $targets_main || [ "$current_branch" = "main" ]; }; then
  echo '{"decision": "block", "reason": "Direct pushes to main are blocked. Create a branch named after the issue and open a PR instead, per CLAUDE.md Guardrails."}'
else
  echo '{}'
fi