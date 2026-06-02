#!/usr/bin/env bash
#
# demo/cycle.sh — a self-contained, non-interactive walkthrough of the mini
# workflow cycle (init → next → plan → do → done), meant to be recorded with
# asciinema (see demo/record.sh) and turned into demo/cycle.gif.
#
# It runs entirely offline: there is NO live Claude API call. The inputs that a
# real session would get from Claude (the proposed phase, the steps, the report)
# are supplied here through the non-interactive `--apply` flags, so every command
# you see below is a real mini command with real output — only the human/Claude
# typing is scripted.
#
# Run it directly to preview the demo in your own terminal:
#   bash demo/cycle.sh
#
set -euo pipefail

# ── Look & feel ──────────────────────────────────────────────────────────────
GREEN=$'\033[1;32m'; CYAN=$'\033[1;36m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RST=$'\033[0m'

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

# say "comment" — a dimmed narration line (not a command).
say() { printf '%s# %s%s\n' "$DIM" "$1" "$RST"; sleep 0.6; }

# run "command" — show a shell prompt, "type" the command, run it, then pause.
run() {
  printf '%s$%s ' "$GREEN" "$RST"
  type_out "$1"
  printf '\n'
  sleep 0.3
  eval "$1"
  sleep "$PROMPT_PAUSE"
}

# ── The demo ─────────────────────────────────────────────────────────────────
cd "$WORK"
git init -q
git config user.email demo@example.com
git config user.name "mini demo"

printf '%smini%s — drive your project one small phase at a time\n\n' "$BOLD$CYAN" "$RST"
sleep 0.8

say "1) Start a project (4 answers; here passed as flags)"
run 'mini init --apply --name "todo-api" --what "A small REST API for todos" --for-whom "Backend developers" --constraints "Node + TypeScript"'
printf '\n'

say "2) Ask for the next phase — Claude proposes it"
run 'mini next --apply --title "Health endpoint" --goal "Add GET /health returning {status:ok} with a test"'
printf '\n'

say "3) Break the phase into concrete, verifiable steps"
run $'printf \'%s\\n\' "Add the route :: GET /health returns 200 JSON {status:ok}" "Write a test :: vitest covers the 200 response" | mini plan --apply'
printf '\n'

say "Where are we?"
run 'mini status'
printf '\n'

say "4) Work the phase — normally \"mini do\" opens an interactive Claude session"
say "   that edits the code and ticks the steps off. Offline, we mark them by hand:"
run 'mini do --apply'
run 'mini do --apply --step-done "Add the route"'
run 'mini do --apply --step-done "Write a test"'
printf '\n'

# The Claude session ends by writing a report; we drop a minimal one in place.
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

say "5) Close the phase — verify, write a memory note, commit"
run 'mini done --apply'
printf '\n'

say "The cycle is closed and committed. Ask for the next phase and repeat."
run 'mini status'
printf '\n'
sleep 1.2
printf '%sThat is the loop: next → plan → do → done. ⟳%s\n' "$BOLD$CYAN" "$RST"
sleep 1.5
