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
