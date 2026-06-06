# `mini install-statusline`

> Enables the mini status line by adding a `statusLine` block to
> `~/.claude/settings.json`. The opt-in install counterpart to
> [`mini uninstall`](uninstall.md).

> **Console-only.** This command has **no** `/mini:*` slash variant — it
> configures your Claude Code environment, it is not a phase step.

## Synopsis

```bash
mini install-statusline            # enable the mini status line
mini install-statusline --dry-run  # preview only — change nothing
```

## Description

The status line shows, in Claude Code, the shortened project directory, the
active model, and context-window usage (and a `↑ <version>` hint when a newer
mini is available). It is rendered by [`mini statusline`](../non-interactive/)
which Claude Code runs via a `statusLine` entry in `~/.claude/settings.json`.

Installing mini does **not** enable the status line on its own — it is opt-in, so
a global `npm i -g` never silently edits your `settings.json`. This command turns
it on when you want it:

- **No status line yet** → adds mini's entry, preserving every other key in the
  file (and creating the file if missing).
- **mini's status line already present** → reports it as a no-op, changes
  nothing (idempotent).
- **A foreign status line present** (yours, GSD's, anything else) → leaves it
  **untouched** and tells you so; remove it yourself first if you want mini's
  instead.

With `--dry-run` it prints what it would do and writes nothing.

## What the status line shows

On one line, rendered by [`mini statusline`](../non-interactive/):

```
mini · Opus 4.8 · 1M ▰▰▰▱▱▱▱▱▱▱ 28%
```

The segments are: the (shortened) project directory, the model with its version,
the context-window size (`200k`/`1M`), and a gauge plus percentage of the
**context-window usage**. The usage is recovered from the session transcript,
since Claude Code does not report token counts to the status line directly.

When a newer mini is available on npm, a yellow `↑ <version>` segment is appended:

```
mini · Opus 4.8 · 1M ▰▰▰▱▱▱▱▱▱▱ 28% · ↑ 1.9.1
```

Run [`mini upgrade`](upgrade.md) to install it (or `mini upgrade --check` to just
see what's available).

## How the version check refreshes

The status line never blocks on the network. It reads a small cached record of
the latest published version (in the OS temp dir) and fires a **detached
background refresh** to update it for next time:

- The refresh runs **on every new Claude Code session** (detected via the session
  id in the status payload) — so you get a fresh check each time you start Claude.
- Within a single long-running session it then refreshes again only once the cache
  is older than **5 hours**.
- A short retry cooldown keeps a failing fetch from re-firing on every render.

The renderer is the `mini statusline` command (it reads the status JSON on stdin);
you normally never run it by hand — Claude Code calls it on every refresh.

## Options

| Flag | Description |
| --- | --- |
| `--dry-run` | Preview only — print what would happen, change nothing. |

## Examples

Enable it on a fresh setup:

```bash
$ mini install-statusline
[ok] Enabled the mini status line in /home/me/.claude/settings.json.
  It shows the project dir, model, and context-window usage in Claude Code.
  Disable it anytime with: mini uninstall (or remove the "statusLine" block).
```

A foreign status line is kept:

```bash
$ mini install-statusline
A non-mini status line is set in /home/me/.claude/settings.json — leaving it untouched.
  Remove it first (e.g. delete the "statusLine" block) if you want mini's instead.
```

## Notes

- **Opt-in by design.** This is why a global install never touches your
  `settings.json`: enabling the status line is an explicit, separate choice.
- It edits only the `statusLine` key; every other setting is preserved, and a
  missing/malformed file is treated as empty (a fresh one is written).
- To turn it back off, use [`mini uninstall`](uninstall.md) (which also removes
  the slash commands) or just delete the `"statusLine"` block by hand.

## Related

- [`mini uninstall`](uninstall.md) — removes the status line this enables (and
  the slash commands).
- [`mini install-commands`](install-commands.md) — installs the `/mini:*` slash
  commands (the other half of the setup).
