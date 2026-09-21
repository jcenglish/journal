#!/usr/bin/env bash
# Claude Code PreToolUse hook — blocks hand-edits to Rails' auto-generated
# schema files. Per CLAUDE.md Guardrails: never hand-edit db/schema.rb —
# always generate and run a migration instead. Same applies to the Solid
# trio's schema files (cache/queue/cable), which are equally generated.

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

case "$file_path" in
  */db/schema.rb|*/db/cache_schema.rb|*/db/queue_schema.rb|*/db/cable_schema.rb)
    echo '{"decision": "block", "reason": "Never hand-edit schema.rb (or the cache/queue/cable schema files) — generate and run a migration instead, per CLAUDE.md Guardrails."}'
    ;;
  *)
    echo '{}'
    ;;
esac
