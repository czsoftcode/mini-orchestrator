# `mini install-commands`

> Writes the `/mini:*` slash commands into Claude Code so you can drive the whole
> phase loop from inside a session. Idempotent — re-run it anytime to refresh
> them.

> **Console-only.** This command has **no** `/mini:*` slash variant — it is what
> *creates* the slash commands in the first place. It is also the **zero-touch
> trial** entry point: `npx mini-orchestrator install-commands` runs it once
> without a global install.

## Synopsis

```bash
mini install-commands            # asks where to install (project vs user) when interactive
mini install-commands --project  # force the current project's .claude/commands/mini
mini install-commands --user     # force the user-wide ~/.claude/commands/mini
mini install-commands --dry-run  # preview what would be created/changed, write nothing

npx mini-orchestrator install-commands   # try it one-off, no global install
```

## Description

The slash commands are normally installed for you by the npm `postinstall` hook
on a global install (`npm i -g mini-orchestrator`). Run `install-commands` by
hand when that hook was skipped (`--ignore-scripts`, `npm ci`, CI), when you want
the commands scoped to **one project**, or to **refresh** them after upgrading
mini.

It writes one `.md` file per command into a `.claude/commands/mini/` directory.
The scope decides where:

- **project** — `.claude/commands/mini` in the current repo (the commands work
  only here; commit them to share with the team).
- **user** — `~/.claude/commands/mini` (the commands work in every project).

Without `--project`/`--user` and with a terminal, it **asks** which one (the
default is project when a local `claude` is detected, otherwise user). Without a
terminal it uses that same detected default silently. It is idempotent: it only
writes files that differ and reports how many were created / changed / left
unchanged. It never touches `~/.claude/settings.json` — the status line is a
separate, opt-in step.

### The `npx` trial

`npx` ships with npm: it fetches the package into a temporary cache and runs it
once, **without** a global install. So `npx mini-orchestrator install-commands`
lets you evaluate mini without it auto-writing anything into `~/.claude` — the
one-off run simply asks where you want the commands and writes only there.

## Options

| Flag | Description |
| --- | --- |
| `--project` | Install into the current project's `.claude/commands/mini`. |
| `--user` | Install into the user-wide `~/.claude/commands/mini` (all projects). |
| `--dry-run` | Preview only — print what would be created/changed, write nothing. |

## Examples

Install into the current project, refreshing on a second run:

```bash
$ mini install-commands --project
[ok] Done — 18 commands in .claude/commands/mini/ (18 new, 0 changed).
  Use them in Claude Code: /mini:init, /mini:next, /mini:discuss, /mini:plan, /mini:do, /mini:done, /mini:auto, /mini:status, /mini:map, /mini:audit, /mini:undo, /mini:model
```

Preview a user-wide install without writing anything:

```bash
$ mini install-commands --user --dry-run
[ok] Done — 18 commands in ~/.claude/commands/mini/ (0 new, 0 changed).
```

## Notes

- **Idempotent.** Re-running only rewrites files whose content changed, so it is
  safe to run after every `mini upgrade` to pick up new or updated commands.
- The slash commands are how the interactive (`/mini:*`) variants exist at all —
  see the [`interactive/`](../interactive/) pages for what each one does.
- This command never edits `~/.claude/settings.json`. To enable the status line
  use [`mini install-statusline`](install-statusline.md); to remove everything
  mini added use [`mini uninstall`](uninstall.md).

## Related

- [`mini install-statusline`](install-statusline.md) — enable the status line
  (the separate, opt-in part of the setup).
- [`mini uninstall`](uninstall.md) — removes the commands this installs (and the
  mini status line).
- [`mini upgrade`](upgrade.md) / [`/mini:upgrade`](../interactive/upgrade.md) —
  update mini itself, then re-run `install-commands` to refresh the slash
  commands.
