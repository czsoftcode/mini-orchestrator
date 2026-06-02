---
phase: 111
verdict: done
steps:
  - title: "Recognize + remove mini statusLine"
    status: done
  - title: "uninstall() command logic"
    status: done
  - title: "Wire visible mini uninstall into CLI"
    status: done
  - title: "Tests for uninstall"
    status: done
  - title: "Verify: typecheck + full tests"
    status: done
---

# Phase 111 — report from the auto session

## What was done

Added a visible `mini uninstall` command that fully cleans up what mini wrote
outside the project tree — the counterpart to install / postinstall.

- **`src/install/statuslineSettings.ts`**: new `isMiniStatusline(entry)` predicate
  that recognizes mini's own `node "…/cli.js" statusline` entry (and crucially
  does **not** match a foreign command that merely contains the substring
  "statusline", e.g. `my-own-statusline`). New pure `removeStatusline(settings)`
  (reasons `removed` / `absent` / `foreign`) and IO `removeStatuslineFromSettings`
  that strips only mini's statusLine, preserves every other key, and treats a
  missing/malformed file as `missing` (nothing to do).
- **`src/commands/uninstall.ts`**: removes user-scope `~/.claude/commands/mini`
  and, when present, project-scope `.claude/commands/mini`, then strips mini's
  status line. `--dry-run` prints the action list and writes nothing; a
  confirmation prompt guards the real run (skipped by `--yes`; without a TTY and
  without `--yes` it aborts with a hint instead of acting unprompted). Prints a
  "nothing to remove" line when mini left nothing behind, and notes when a
  foreign status line is being left intact.
- **`src/cli.ts`**: wired a **visible** `uninstall` command with `--dry-run` and
  `-y/--yes`.

## Verification (all mechanical)

- `npm run typecheck` — clean.
- `npm test` — 67 files, 849 tests pass (16 new across statusline + uninstall).
- Smoke test via `tsx` in an isolated `HOME`: dry-run lists both the commands dir
  and the status line and changes nothing; `--yes` deletes the commands dir and
  strips the mini statusLine while keeping the other settings keys (`model`
  preserved). A foreign statusLine is left intact (covered by unit tests).

## Notes / follow-ups

- Remaining from the original split: unhide `install-commands` and document the
  `npx mini-orchestrator install-commands` trial path at the top of README; also
  worth a short docs page for `uninstall` (per the docs/ convention).
