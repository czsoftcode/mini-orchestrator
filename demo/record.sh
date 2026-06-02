#!/usr/bin/env bash
#
# demo/record.sh — record demo/cycle.sh with asciinema and convert it to
# demo/cycle.gif with agg. Reproducible and idempotent: re-run it to refresh
# the GIF after changing the walkthrough.
#
# Prerequisites (all installable without root):
#   - asciinema   (Debian/Ubuntu:  apt install asciinema   |  pipx install asciinema)
#   - agg         (cargo install --git https://github.com/asciinema/agg --locked)
#                 NOTE: the `agg` crate on crates.io is a different library — use the git one.
#                 It lands in ~/.cargo/bin, which this script adds to PATH automatically.
#
# Usage:
#   bash demo/record.sh            # record + render demo/cycle.gif
#
set -euo pipefail

# Repo-relative paths, independent of the caller's CWD.
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
GIF="$HERE/cycle.gif"

# agg is commonly installed into ~/.cargo/bin, which isn't always on PATH.
export PATH="$HOME/.cargo/bin:$PATH"

# Terminal geometry of the recording (kept narrow so the GIF stays legible).
COLS=${COLS:-92}
ROWS=${ROWS:-30}

need() {
  command -v "$1" >/dev/null 2>&1 && return 0
  printf 'error: "%s" not found. %s\n' "$1" "$2" >&2
  return 1
}

need asciinema 'Install: apt install asciinema  (or: pipx install asciinema)' || exit 1
need agg 'Install: cargo install --git https://github.com/asciinema/agg --locked' || exit 1

CAST=$(mktemp --suffix=.cast)
cleanup() { rm -f "$CAST"; }
trap cleanup EXIT

echo "→ recording demo/cycle.sh (${COLS}x${ROWS}) …"
asciinema rec \
  --overwrite --quiet \
  --cols "$COLS" --rows "$ROWS" \
  --idle-time-limit 2 \
  --title "mini — the workflow cycle" \
  --command "bash '$HERE/cycle.sh'" \
  "$CAST"

echo "→ rendering $GIF …"
agg \
  --theme asciinema \
  --font-size 18 \
  --speed 1.2 \
  "$CAST" "$GIF"

echo "✓ wrote $GIF ($(du -h "$GIF" | cut -f1))"
