---
phase: 107
verdict: done
steps:
  - title: "Route mini update to the upgrade action"
    status: done
  - title: "Remove the orphaned skeleton-sync update()"
    status: done
  - title: "Repoint stale mini update references"
    status: done
  - title: "Update README and docs"
    status: done
---

# Phase 107 — report from the auto session

Made `mini update` a silent alias for `mini upgrade`, per the user's explicit
decision (the user was told twice that the two commands do different things and
chose the silent alias anyway).

## What was done

- **`cli.ts`** — the `update` command now takes `--check`/`--yes` (dropped
  `--dry-run`) and calls `upgrade()`; its description states it is an alias for
  `mini upgrade`. Verified via `node dist/cli.js update --help`.
- **`commands/update.ts`** — removed the now-orphaned `update()` wrapper (it was
  only reachable from the CLI). Kept `syncSkeleton()` (and its tests), which
  `mini init` still imports. Trimmed the now-unused imports (`exists`,
  `installCommands`, `StepOutcome`).
- **Tests** — dropped the `describe('update')` block from `update.test.ts`
  (kept the four `syncSkeleton` tests); updated `doctor.test.ts` to expect the
  `install-commands` hint.
- **Repointed references** — `mini doctor`'s "slash commands out of date" hint
  now says `mini install-commands`; fixed/translated the comments in `assets.ts`
  (was Czech), `install/commands.ts`, `commands/install-commands.ts` and
  `init.ts` that described `mini update` as the skeleton sync.
- **Docs** — README `mini update` row rewritten as an alias of `upgrade` (with a
  pointer to `mini install-commands` for refreshing slash commands);
  `docs/{interactive,non-interactive}/doctor.md` hints changed to
  `mini install-commands`.
- Added a `### Changed` entry to `CHANGELOG.md`.

## A note worth flagging (not a blocker)

This phase **removes functionality**: there is no longer a single command that
syncs both the `.mini/` skeleton *and* the slash commands. `mini init` still
writes the skeleton (`syncSkeleton`), and `mini install-commands` still refreshes
the slash commands, but the combined "bring the whole project up to date" that
`mini update` used to do is gone. If that combined refresh turns out to be
wanted, it could be reintroduced under a clearer name later.

The `installCommands` wrapper (`commands/install-commands.ts`) is now only
reached from its own test (production install goes through `installSlashCommands`
→ `writeCommandsTo`). It was kept because that test verifies the generated
slash-command bodies — valuable coverage — but it is a candidate for a future
tidy-up.

## Verification done by me (mechanical)

- `tsc --noEmit` clean; `npm run build` succeeds.
- Full test suite: **828 passed (65 files)**.
- `node dist/cli.js update --help` shows the alias description and the
  `--check` / `--yes` flags.
- No stale `mini update` references remain in `src/` except the intentional one
  in the alias description.
