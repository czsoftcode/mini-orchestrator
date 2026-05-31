---
phase: 86
verdict: done
steps:
  - title: "Extract slash-command generator into shared module"
    status: done
  - title: "Add Claude Code detection helper"
    status: done
  - title: "Add install routine with project-vs-user target"
    status: done
  - title: "Wire npm postinstall (non-interactive-safe)"
    status: done
  - title: "Remove public install-commands, keep hidden fallback"
    status: done
verify:
  - title: "Interactive postinstall prompt on a real npm install"
    detail: "The no-TTY path is covered by tests and a manual run of scripts/postinstall.mjs (writes nothing, prints the hint, exit 0). The interactive branch (the project-vs-user select shown during an actual `npm install` in a terminal) could not be exercised here — this Bash has no TTY. Worth a real `npm install` (or `npm install -g`) from a terminal to confirm the prompt appears and the default matches the detected scope."
---

# Phase 86 — report from the auto session

## What was done
The slash-command installation was reworked from a public `mini install-commands`
command into an npm `postinstall` hook, while keeping a hidden manual fallback.

- **Shared generator** — `COMMAND_DEFS`, `CommandDef`, `renderCommandMd` and a new
  `writeCommandsTo(targetDir, {dryRun, displayDir})` now live in
  `src/install/commands.ts`. `src/commands/install-commands.ts` became a thin
  project-scoped wrapper that re-exports the old API (so `update.ts` and existing
  tests are untouched) and delegates the write to `writeCommandsTo`.
- **Detection** — `src/install/detectClaude.ts` reports installed / global (on
  PATH) / local (`node_modules/.bin/claude`), plus `recommendedScope()`. Pure and
  synchronous, injectable `pathDirs`/`isExecutable` for tests.
- **Install routine** — `src/install/install.ts`: `resolveTarget()` maps a scope to
  the project dir or `~/.claude/commands/mini` (via `os.homedir()`), and
  `installSlashCommands()` picks the scope (explicit > interactive TTY prompt >
  detected default) and writes via the shared helper.
- **postinstall** — `src/install/postinstall.ts` (`runPostinstall`) + a pure-Node
  guarded launcher `scripts/postinstall.mjs`. No TTY → prints a hint and writes
  nothing; with a TTY → runs the installer; all errors are downgraded so
  `npm install` never fails. Uses `INIT_CWD` as the target project. `package.json`
  got `"postinstall": "node scripts/postinstall.mjs"`, and the launcher was added
  to `files` so it ships.
- **Hidden fallback** — the `install-commands` command is now `{ hidden: true }`,
  routed to `installSlashCommands` with `--user` / `--project` / `--dry-run`. README
  updated (postinstall is the normal path; the command is the manual fallback).

## Verification done mechanically
- `tsc --noEmit` clean; full suite **668 tests / 53 files pass** (incl. the new
  tests across detectClaude/install/postinstall).
- Clean `npm run build` succeeds; `*.test.ts` are excluded by
  `tsconfig.build.json` so nothing leaks into `dist`; `dist/install/postinstall.js`
  present.
- Guarded launcher: silent + exit 0 when `dist` is absent (fresh dev clone), and
  no-TTY run writes nothing + exit 0.
- Hidden command absent from `mini --help` but still callable; against the fresh
  build, `install-commands --project` writes 11 command files into a temp project,
  and `--user --dry-run` previews the user scope correctly (lists "Will be created"
  under `~/.claude/commands/mini` and writes nothing).

## Notes
- `installCommands` (project-scoped wrapper in `src/commands/install-commands.ts`)
  is intentionally kept — `mini update` still uses it, and existing tests import
  the old API through it unchanged.

## Fix after manual verification
- The new `postinstall` hook broke `npm run install-local`: that script copies only
  `dist/` + `package.json` into `~/.local/share/mini/versions/<v>/` and then runs
  `npm install --omit=dev` there, which tried to run the package's `postinstall`
  (`scripts/postinstall.mjs`, not copied) → `MODULE_NOT_FOUND` crash.
- Fixed by adding `--ignore-scripts` to that install in `scripts/install-local.sh`
  (the postinstall hook is for end users installing mini via npm, not for the local
  install of the tool itself). Re-ran `npm run install-local` — exit 0, `mini
  --version` → 1.5.3, `install-commands` hidden from `--help`.
