# Phase 86 — npm postinstall installs slash commands

**Goal:** Remove the public 'mini install-commands' command and install the /mini:* slash commands via an npm postinstall hook: detect Claude Code (installed? local vs global), interactively ask whether to install into the user-level ~/.claude/commands/mini or the project .claude/commands/mini, and copy idempotently. Keep a hidden fallback install path and skip silently (with a hint) when there is no TTY.

## Steps
- [done] Extract slash-command generator into shared module
- [done] Add Claude Code detection helper
- [done] Add install routine with project-vs-user target
- [done] Wire npm postinstall (non-interactive-safe)
- [done] Remove public install-commands, keep hidden fallback

## Auto-commit
- Phase 86: npm postinstall installs slash commands

## Discussion
# Phase 86 — User-scope install slash commands

## Intent
The original direction (extend `mini install-commands` with a `--user` flag) was
dropped. The new direction is the opposite: **remove the public
`mini install-commands` command and drive slash-command installation from an npm
`postinstall` hook**.

On `npm install` the postinstall script should:
1. **Detect Claude Code** — whether it is installed, and whether it is a
   **global** install or a **local** (project dependency) one.
2. **Ask the user** (interactively) where to put the `/mini:*` commands:
   into the user-level `~/.claude/commands/mini/` or into the project
   `.claude/commands/mini/`.
3. **Copy/generate** the commands into the chosen location (idempotent,
   diff-based, like today's installer).

The user chose to do the **whole feature in one phase** (postinstall +
detection + interactive prompt + removal of `install-commands`). It is on the
large side for a single phase — `mini plan` should break it into clear steps.

## Key decisions
- **Remove the public `mini install-commands`** command (CLI, help, docs), but
  **keep a hidden/fallback manual install path** (e.g. fold the install into
  `mini update`, or a hidden command) for cases where `postinstall` is skipped
  (`--ignore-scripts`, some `npm ci` setups, CI).
- **postinstall must be non-interactive-safe**: when there is no TTY (CI,
  `npm ci`, piped install), it **silently skips** the copy and prints a short
  hint that the commands can be installed manually at any time, **including the
  exact command to run**. Only prompt when `process.stdin.isTTY` is true.
- The slash-command generator (`COMMAND_DEFS`, `renderCommandMd`, `CommandDef`,
  currently in `src/commands/install-commands.ts`) must move into a **shared
  module** so the postinstall script, `mini update` and the hidden fallback all
  reuse it (no drift).

## Watch out for
- **postinstall fragility**: no TTY in `npm ci`/CI (don't hang the install);
  skipped entirely with `--ignore-scripts` (hence the fallback path).
- The generator must end up in the published **`dist/`** so the compiled
  `postinstall` script can `import` it after build. Wire the `postinstall`
  script in `package.json` to a built JS entry (and make sure local dev /
  `prepublishOnly` build covers it).
- **Define "local vs global" detection** concretely during plan/do: e.g. global
  = `claude` resolvable on PATH (`which claude`); local = `node_modules/.bin/claude`
  in the install target. Decide how the detected scope influences the default in
  the project-vs-user prompt.
- Interactive prompt can reuse the existing UI helpers (`src/ui/ask.ts`,
  `src/ui/interactive.ts`).
- Removing `install-commands` touches several places: CLI registration in
  `cli.ts`, `--help`, `README`/docs, the `install-commands.test.ts` tests, and
  the "Use them in Claude Code: …" hint list. `mini update` already writes the
  project commands — reconcile so there is a single shared code path.
- `~` resolution via `os.homedir()` (already imported in `install-commands.ts`).
- The phase **title/goal stored in state is now stale** ("extend
  install-commands / --user"). Re-title before `mini plan` (undo + `mini next`
  with a corrected title/goal, e.g. "npm postinstall installs slash commands").

## Run report
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
