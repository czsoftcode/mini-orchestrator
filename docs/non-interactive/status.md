# `mini status`

> Shows where the project currently is — the phase overview.

**Interactive variant:** [`/mini:status`](../interactive/status.md) — the slash
command runs this and relays the output into the chat.

## Synopsis

```bash
mini status               # human-readable phase overview
mini status --json        # machine-readable JSON object
mini status --phase 12    # detail of a single phase
mini status --phase 12 --json   # …as a machine-readable object
```

## Description

`mini status` prints the project header (name, what, models) and the list of
phases with their status and duration. With `--json` it prints a single
machine-readable object instead — for scripts and integrations.

With `--phase <n>` it zooms in on **one** phase instead of the overview: its
title, goal, status and duration, every step **with its planning detail**, and
the phase's run report (verdict, items pending manual verification, and the
free-text notes). Combine it with `--json` for the same detail as an object. An
unknown `<n>` fails with a clean error (exit code 1).

## Options

| Flag | Description |
| --- | --- |
| `--json` | Print a machine-readable JSON object instead of the human overview. |
| `--phase <n>` | Show the detail of a single phase (steps + detail + run report) instead of the overview. Combine with `--json` for a machine-readable object. |

The overview JSON object includes `title`, `what`, `models`, `currentPhaseId`,
the count of open ideas, and a `phases` array (each with `id`, `title`,
`status`, timestamps, `durationMs`, and `steps`).

The `--phase <n> --json` object describes one phase: `id`, `title`, `goal`,
`status`, `isCurrent`, timestamps, `durationMs`, a `steps` array (each with
`title`, `status` and optional `detail`), and `runReport` (`verdict`,
`unparseable`, `verify`, optional `body`) or `null` when no report exists.

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

Zoom in on a single phase:

```bash
$ mini status --phase 12

  [done]   > 12. Pagination for /todos (took 1h 4m)
    Goal: GET /todos accepts ?page and ?limit; covered by a test.

  Steps:
    [done]   Add ?page/?limit parsing
               rejects non-numeric values with 400
    [done]   Paginate the query

  Run report:
    run report: verdict done · all verified

    Implemented as planned; …
```

Pipe the JSON form into a tool:

```bash
$ mini status --json | jq '.phases[-1].title'
"mini status --json"

$ mini status --phase 12 --json | jq '.runReport.verdict'
"done"
```

## Notes

- It is **read-only** — it changes no state in `.mini/`.
- The `--json` output is undecorated (no colors, no extra lines), safe to pipe.

## Related

- [`/mini:status`](../interactive/status.md) — interactive variant
- [`mini doctor`](doctor.md) — health check of the setup
- [`mini changelog`](changelog.md) — released changes
