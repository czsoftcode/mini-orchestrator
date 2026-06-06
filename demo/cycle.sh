#!/usr/bin/env bash
#
# demo/cycle.sh — a self-contained, offline walkthrough of the mini workflow as
# you actually drive it: the interactive /mini:* slash commands inside a Claude
# Code session (init → next → plan → do → done). Meant to be recorded with
# asciinema (see demo/record.sh) and turned into demo/cycle.gif.
#
# It runs entirely offline: there is NO live Claude API call. The lines spoken
# by "Claude" are SCRIPTED and illustrative — a real session phrases things
# differently each time. What is genuine is every "[ok] …" line: under the hood
# each slash command runs the very same `mini … --apply` sub-command shown in
# the CLI, so the state-changing output you see is the real tool output.
#
# Run it directly to preview the demo in your own terminal:
#   bash demo/cycle.sh
#
set -euo pipefail

# ── Look & feel ──────────────────────────────────────────────────────────────
GREEN=$'\033[1;32m'; CYAN=$'\033[1;36m'; MAGENTA=$'\033[1;35m'
DIM=$'\033[2m'; BOLD=$'\033[1m'; RST=$'\033[0m'

# Pacing (overridable from the environment so record.sh can tune it).
TYPE_DELAY=${TYPE_DELAY:-0.018}   # seconds per typed character
PROMPT_PAUSE=${PROMPT_PAUSE:-0.5} # pause after a command's output

# A working directory that we clean up on exit.
WORK=$(mktemp -d)
cleanup() { cd /; rm -rf "$WORK"; }
trap cleanup EXIT

# type_out "text" — print text with a light typewriter effect.
type_out() {
  local s=$1 i
  for (( i = 0; i < ${#s}; i++ )); do
    printf '%s' "${s:i:1}"
    sleep "$TYPE_DELAY"
  done
}

# you "text" — a line the human types at the Claude Code prompt (slash command
# or a short answer). Rendered with the session's "> " prompt.
you() {
  printf '%s>%s ' "$GREEN$BOLD" "$RST"
  type_out "$1"
  printf '\n'
  sleep 0.35
}

# claude "line" ["line2" …] — Claude's reply. SCRIPTED/illustrative prose,
# rendered under a "✦ Claude" header so it reads as the assistant talking.
claude() {
  printf '%s✦ Claude%s\n' "$MAGENTA$BOLD" "$RST"
  local line
  for line in "$@"; do
    printf '  %s\n' "$line"
    sleep 0.25
  done
  sleep 0.4
}

# run "command" — the real mini sub-command a slash command calls under the
# hood. Its genuine output (the "[ok] …" lines) is what you see.
run() { eval "$1"; sleep "$PROMPT_PAUSE"; }

# ── The demo ─────────────────────────────────────────────────────────────────
cd "$WORK"
git init -q
git config user.email demo@example.com
git config user.name "mini demo"

printf '%smini%s — drive your project one small phase at a time, from inside Claude Code\n' "$BOLD$CYAN" "$RST"
printf '%s(Claude'\''s replies below are scripted & illustrative; the [ok] lines are real mini output.)%s\n\n' "$DIM" "$RST"
sleep 1.0

# 1) init ----------------------------------------------------------------------
you '/mini:init'
claude 'Four quick questions — name, what you'\''re building, who for, constraints.'
you 'todo-api · A small REST API for todos · Backend developers · Node + TypeScript'
run 'mini init --apply --name "todo-api" --what "A small REST API for todos" --for-whom "Backend developers" --constraints "Node + TypeScript"'
printf '\n'

# 2) next ----------------------------------------------------------------------
you '/mini:next  start with a health endpoint'
claude 'I propose phase 1 — "Health endpoint": add GET /health returning' \
       '{status:ok}, covered by a test. Save it?'
you 'yes'
run 'mini next --apply --title "Health endpoint" --goal "Add GET /health returning {status:ok} with a test"'
printf '\n'

# 3) plan ----------------------------------------------------------------------
you '/mini:plan'
claude 'Breaking it into two small, verifiable steps:'
run $'printf \'%s\\n\' "Add the route :: GET /health returns 200 JSON {status:ok}" "Write a test :: vitest covers the 200 response" | mini plan --apply'
printf '\n'

# 4) do ------------------------------------------------------------------------
you '/mini:do'
claude 'On it — I'\''ll edit the code and tick each step off as I finish it.'
run 'mini do --apply'
run 'mini do --apply --step-done "Add the route"'
run 'mini do --apply --step-done "Write a test"'
# The Claude session ends by writing a report; offline we drop a minimal one in.
cat > .mini/run/phase-001.md <<'EOF'
---
phase: 1
verdict: done
steps:
  - title: "Add the route"
    status: done
  - title: "Write a test"
    status: done
---

# Phase 1 — report

Added GET /health returning {status:"ok"} and a vitest covering the 200 response.
EOF
printf '\n'

# 5) done ----------------------------------------------------------------------
you '/mini:done'
claude 'Both steps done. Writing a memory note and committing the phase.'
run 'mini done --apply'
printf '\n'

claude 'Phase closed and committed. Ask for the next one and the loop repeats.'
run 'mini status'
printf '\n'
sleep 1.2
printf '%sThat is the loop: next → plan → do → done. ⟳%s\n' "$BOLD$CYAN" "$RST"
sleep 1.5
