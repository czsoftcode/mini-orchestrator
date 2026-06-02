# `mini uninstall`

> Removes everything mini wrote outside the project tree: the `/mini:*` slash
> commands and mini's own status line. The counterpart to
> [`mini install-commands`](install-commands.md) and the npm `postinstall` hook.

> **Console-only.** This command has **no** `/mini:*` slash variant — you run it
> in a terminal, typically right before or after `npm uninstall -g
> mini-orchestrator` to clean up fully.

## Synopsis

```bash
mini uninstall            # show what will be removed, then ask for confirmation
mini uninstall --dry-run  # preview only — change nothing
mini uninstall --yes      # remove without the confirmation prompt
```

## Description

`npm uninstall -g mini-orchestrator` removes the package but leaves behind what
mini wrote into your Claude Code config. `mini uninstall` cleans that up:

- **Slash commands** — deletes `~/.claude/commands/mini` (user scope) and, when
  present, the current project's `.claude/commands/mini`.
- **Status line** — strips **only mini's own** `statusLine` entry from
  `~/.claude/settings.json` (recognized by its `mini … statusline` command). A
  foreign status line — yours, GSD's, or anything else — is **left untouched**,
  and every other key in the file is preserved.

It first prints the exact list of what it will do. With a terminal it then asks
for confirmation (default *no*); `--yes` skips that prompt. Without a terminal
and without `--yes` it **aborts** rather than act unprompted. When mini left
nothing behind, it says so and changes nothing.

## Options

| Flag | Description |
| --- | --- |
| `--dry-run` | Preview only — print what would be removed, change nothing. |
| `-y`, `--yes` | Skip the confirmation prompt. |

## Examples

Preview, then remove:

```bash
$ mini uninstall --dry-run

mini uninstall will:
  - remove ~/.claude/commands/mini
  - remove the mini status line from ~/.claude/settings.json
Dry run — nothing was changed.

$ mini uninstall --yes

mini uninstall will:
  - remove ~/.claude/commands/mini
  - remove the mini status line from ~/.claude/settings.json
[ok] Removed mini.
  Deleted ~/.claude/commands/mini
  Removed the status line from ~/.claude/settings.json
  To remove the package itself: npm uninstall -g mini-orchestrator
```

When a foreign status line is present it is kept:

```bash
$ mini uninstall --yes

mini uninstall will:
  - remove ~/.claude/commands/mini
  A non-mini status line in ~/.claude/settings.json is left untouched.
[ok] Removed mini.
  Deleted ~/.claude/commands/mini
  To remove the package itself: npm uninstall -g mini-orchestrator
```

## Notes

- It removes config mini wrote, **not** the npm package itself — finish with
  `npm uninstall -g mini-orchestrator`.
- Your project's `.mini/` state directory is **never** touched; this command is
  about Claude Code's global/project config only.
- Safe to run when nothing is installed: it reports "nothing to remove" and exits
  without changes.

## Related

- [`mini install-commands`](install-commands.md) — installs the commands this
  removes.
- [`mini install-statusline`](install-statusline.md) — enables the status line
  this removes (its opt-in counterpart).
- [`mini upgrade`](upgrade.md) / [`/mini:upgrade`](../interactive/upgrade.md) —
  update mini instead of removing it.
