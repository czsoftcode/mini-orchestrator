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
title, goal, status and duration, every step **with its planning detail**, the
phase's **decision record** (when one exists — see
[Decision records](#decision-records)), and the phase's run report (verdict,
items pending manual verification, and the free-text notes). Combine it with
`--json` for the same detail as an object. An unknown `<n>` fails with a clean
error (exit code 1).

## Options

| Flag | Description |
| --- | --- |
| `--json` | Print a machine-readable JSON object instead of the human overview. |
| `--phase <n>` | Show the detail of a single phase (steps + detail + run report) instead of the overview. Combine with `--json` for a machine-readable object. |

The overview JSON object includes `title`, `what`, `models`, `currentPhaseId`,
the count of open ideas, and a `phases` array (each with `id`, `title`,
`status`, timestamps, `durationMs`, `hasDecision` — whether the phase carries a
decision record — and `steps`).

The `--phase <n> --json` object describes one phase: `id`, `title`, `goal`,
`status`, `isCurrent`, timestamps, `durationMs`, a `steps` array (each with
`title`, `status` and optional `detail`), `decision` (the raw markdown of the
phase's decision record, or `null` when none exists), and `runReport`
(`verdict`, `unparseable`, `verify`, optional `body`) or `null` when no report
exists.

## Decision records

A phase may carry a **lightweight decision record (ADR)** — a short note that
captures the *why* behind a non-trivial choice (the rejected alternative and the
reason), which neither the goal nor the commit message preserves. It lives in a
single markdown file:

```
.mini/decisions/phase-<n>.md
```

The convention is deliberately lean:

- **the file's existence is the single source of truth** — there is no flag in
  `state.json` or in the phase file, so there is nothing to keep in sync;
- **a minimal structure** — a heading plus a `Decision` (what was chosen) and a
  `Why` (the rejected alternative and the reason);
- **at most one decision per phase** — multiple reasons go as sections into the
  same file, not as a second file;
- **no independent numbering** — the file is bound to the phase id, like the run
  report (`.mini/run/phase-<n>.md`).

When the file exists, `mini status --phase <n>` renders its raw markdown under a
`Decision:` heading (and `--json` carries it in the `decision` field). The raw
text is shown as-is — `mini` does not parse the `Decision`/`Why` sections.

In the **overview** (`mini status`), every phase that has a decision record is
flagged with a compact `✎ ADR` marker after its title (and `--json` sets
`hasDecision: true` for it). The whole overview costs a single `readdir` of
`.mini/decisions/` — there is no per-phase read.

## Examples

```bash
$ mini status
mini orchestrator on top of Claude Code
  …
Phases:
  [done]   1. Test infrastructure (took 3m 29s)
  [done]   12. Pagination for /todos (took 1h 4m) ✎ ADR
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

  Decision:
    # Offset pagination, not cursors
    ## Decision
    Use ?page/?limit offset paging.
    ## Why
    Cursors were rejected — the dataset is small and the client needs jumpable pages.

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

$ mini status --phase 12 --json | jq -r '.decision // "—"'
# Offset pagination, not cursors
…
```

## Notes

- It is **read-only** — it changes no state in `.mini/`.
- The `--json` output is undecorated (no colors, no extra lines), safe to pipe.

## Related

- [`/mini:status`](../interactive/status.md) — interactive variant
- [`mini doctor`](doctor.md) — health check of the setup
- [`mini changelog`](changelog.md) — released changes
