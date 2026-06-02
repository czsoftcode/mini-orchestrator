# Phase 113 — Příkaz mini install-statusline

**Goal:** Add a visible mini install-statusline command (the install counterpart to mini uninstall) that enables the mini status line via the existing installStatusline() — adding the statusLine block to ~/.claude/settings.json, never overwriting a foreign one and preserving other keys — with --dry-run and a clear summary, plus docs (README + docs/non-interactive/install-statusline.md) and updated pointers from the postinstall opt-in hint and mini uninstall.

## Steps
- [done] install-statusline command logic
- [done] Wire visible mini install-statusline into CLI
- [done] Update pointers
- [done] Tests for install-statusline
- [done] Docs: README + page + index
- [done] Verify: typecheck, tests, --help, smoke

## Auto-commit
- Phase 113: Příkaz mini install-statusline

## Run report
---
phase: 113
verdict: done
steps:
  - title: "install-statusline command logic"
    status: done
  - title: "Wire visible mini install-statusline into CLI"
    status: done
  - title: "Update pointers"
    status: done
  - title: "Tests for install-statusline"
    status: done
  - title: "Docs: README + page + index"
    status: done
  - title: "Verify: typecheck, tests, --help, smoke"
    status: done
---

# Phase 113 — report from the auto session

## What was done

Closed the gap left by phase 110: there was a way to *remove* the status line
(`mini uninstall`) but no clean way to *enable* it after the opt-in change. Added
the missing install counterpart.

- **`src/commands/install-statusline.ts`**: new `installStatuslineCommand()` that
  enables the status line via the existing `installStatusline()`. It classifies
  the current state first (using `isMiniStatusline`) and prints a precise summary:
  **added** (creating settings.json if missing, preserving other keys),
  **already enabled** (mini's own → no-op), or **left a foreign status line
  untouched**. `--dry-run` previews without writing.
- **`src/cli.ts`**: wired a **visible** `install-statusline` command with
  `--dry-run`.
- **Pointers updated**: the postinstall opt-in hint now says
  `Turn it on later with:  mini install-statusline`; the `install-commands` and
  `uninstall` docs cross-link to it; the README opt-in sentence links it.
- **Docs**: new `docs/non-interactive/install-statusline.md` (console-only) per
  the convention, plus an "Enable the status line" row in the docs index and the
  console-only note updated.

## Verification (all mechanical)

- `npm run typecheck` — clean.
- `npm test` — 68 files, 854 tests pass (5 new for install-statusline).
- `mini --help` (via `tsx`) lists `install-statusline`.
- Smoke test in an isolated `HOME`: fresh add writes the mini `statusLine`
  (preserving the rest); a second run is reported idempotent; a foreign
  `my-own-statusline` is left untouched.

## Notes

- Rounds out the install/uninstall symmetry: `install-commands` + `install-statusline`
  on the way in, `uninstall` on the way out.
- No `/mini:*` slash variant — it configures the environment, not a phase.
