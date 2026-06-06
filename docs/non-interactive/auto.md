# `mini auto`

> Auto chain: drives whole phases on its own (next → plan → do → done), pausing
> for human checks.

**Interactive variant:** [`/mini:auto`](../interactive/auto.md) — the autonomous
loop run from inside a Claude Code session, where the per-phase Claude work
actually happens. This terminal command is the scriptable entry point with the
same version switches.

## Synopsis

```bash
mini auto
mini auto --max-turns 12
mini auto --bump patch
mini auto --bump minor --push
```

## Description

`mini auto` runs the phase loop on its own: for each phase it goes
`next → plan → do → done`, then continues with the next phase. It is **not** a
fully unattended run — it stops and asks a human at items flagged for manual
verification (verify). The version switches (`--bump`, `--push`) are applied
when **each** phase is closed.

## Options

| Flag | Description |
| --- | --- |
| `--max-turns <n>` | Maximum number of Claude responses in **each** session — after N responses that session stops automatically (saves tokens). Positive integer. |
| `--bump <level>` | Version bump in `package.json` when closing **each** phase: `none` \| `patch` \| `minor` \| `major`. **Default `none`.** |
| `--push` | After committing each phase, push to the remote. **Requires `--bump patch \| minor \| major`.** |

> The interactive `/mini:auto` accepts more switches in its argument string —
> `--max-phases N`, `--yolo`, `--verify`, `--discuss` — because the loop control
> lives in the session prompt. See [`/mini:auto`](../interactive/auto.md).

## Examples

```bash
$ mini auto --bump patch
# Runs the phase loop; closes each phase with a patch bump.
# Stops and asks you at any manual-verification (verify) item.
```

`--push` requires a real bump:

```bash
$ mini auto --push
With --push you must choose a version level: --bump patch | minor | major.
```

## How a phase runs

Each phase runs as **one Claude session for the whole phase**, started with
`--permission-mode acceptEdits` (Edit/Write happen without asking; Bash still
asks). The single session is deliberate: every Claude restart would re-explore
the project (Read/Glob, reloading context) with no added value, so the whole
phase is implemented in one pass.

Before the session ends, Claude writes a report into `.mini/run/phase-{id}.md`
with two parts:

- **YAML front matter** — the per-step statuses (`done` / `skipped` / `blocked` /
  `todo`) and the overall phase verdict (`done` / `partial` / `blocked`). The
  auto close (`done({auto})`) moves the state in `state.json` from this block.
- **Free text** — a short summary for you (what went well, what Claude ran into,
  open questions).

If unclosed steps remain after a session (Claude didn't finish, or the report is
missing), auto runs another attempt — **at most 3 passes** in total. The second
and third attempts get a link to the backed-up report (`phase-{id}.prev.md`) in
the prompt, so Claude knows where the previous attempt stopped. After the limit
is exhausted, auto finishes with a warning and hands control back to you.

When a session ends **without** a report (a crash, `--max-turns`, a manual
`/exit`), auto won't blindly mark anything — it drops into the interactive
[`done`](done.md) and asks you per step. The reports in `.mini/run/` stay as
history after a phase is finalized.

## Notes

- Auto stops on its own at: the configured phase limit, a finished project, a
  blocker it cannot get around, or a cooperative stop signal.
- A running auto can be halted gracefully with [`mini stop`](stop.md) from
  another terminal — it finishes the current step, writes the report, and exits.
- `--push` always tags, so it needs an explicit `--bump patch | minor | major`.

## Related

- [`/mini:auto`](../interactive/auto.md) — interactive variant (full switch set)
- [`mini stop`](stop.md) — signal a running auto to stop
- [`mini done`](done.md) — how each phase is closed
