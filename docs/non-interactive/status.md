# `mini status`

> Shows where the project currently is — the phase overview.

**Interactive variant:** [`/mini:status`](../interactive/status.md) — the slash
command runs this and relays the output into the chat.

## Synopsis

```bash
mini status          # human-readable phase overview
mini status --json   # machine-readable JSON object
```

## Description

`mini status` prints the project header (name, what, models) and the list of
phases with their status and duration. With `--json` it prints a single
machine-readable object instead — for scripts and integrations.

## Options

| Flag | Description |
| --- | --- |
| `--json` | Print a machine-readable JSON object instead of the human overview. |

The JSON object includes `title`, `what`, `models`, `currentPhaseId`, the count
of open ideas, and a `phases` array (each with `id`, `title`, `status`,
timestamps, `durationMs`, and `steps`).

## Examples

```bash
$ mini status
mini orchestrator on top of Claude Code
  …
Phases:
  [done]   1. Test infrastructure (took 3m 29s)
  …
  Next: mini next (proposes the next phase)
```

Pipe the JSON form into a tool:

```bash
$ mini status --json | jq '.phases[-1].title'
"mini status --json"
```

## Notes

- It is **read-only** — it changes no state in `.mini/`.
- The `--json` output is undecorated (no colors, no extra lines), safe to pipe.

## Related

- [`/mini:status`](../interactive/status.md) — interactive variant
- [`mini doctor`](doctor.md) — health check of the setup
- [`mini changelog`](changelog.md) — released changes
