# `mini do`

> Runs Claude Code on the current phase or step and writes a report.

**Interactive variant:** [`/mini:do`](../interactive/do.md) — the slash command
implements the phase in the current session, using the `--apply` forms below for
state tracking.

## Synopsis

```bash
mini do                              # runs Claude Code on the current phase
mini do --stream                     # same, with live streamed JSON output
mini do --max-turns 8                # cap the number of Claude responses
mini do --apply                      # mark the phase as in progress, create .mini/run/
mini do --apply --step-done "title"  # mark one step done (live tracking)
```

## Description

`mini do` is the implementation step. Run bare (or with `--stream` /
`--max-turns`), it spawns a Claude Code session that implements the current
phase. The `--apply` forms do **no** Claude work — they only move state, and are
what the interactive `/mini:do` calls: `--apply` on its own marks the phase
`doing` and creates `.mini/run/`; `--apply --step-done "<title>"` ticks one step
off as it is finished.

## Options

| Flag | Description |
| --- | --- |
| `--stream` | Run Claude in non-interactive print mode with streamed JSON output (shows the current action live, summarizes cost and tokens at the end). |
| `--max-turns <n>` | Maximum number of Claude responses in the session — after N responses it stops automatically (saves tokens). Positive integer. |
| `--apply` | Non-interactively mark the phase as in progress and create `.mini/run/` (no Claude). |
| `--step-done <title>` | With `--apply`: mark one step of the current phase as done. The title must match the planned step **verbatim**. |

## Examples

Start the phase and tick steps off as you go:

```bash
$ mini do --apply
[ok] Phase 12 (Pagination for /todos) marked as in progress.

$ mini do --apply --step-done "JSON status builder"
[ok] Step "JSON status builder" marked as done.
```

Run the implementation session with a token cap:

```bash
$ mini do --max-turns 10 --stream
# Streams Claude's actions; stops after at most 10 responses.
```

## Notes

- `--step-done` titles must be copied **character for character** from the plan;
  a mismatch is rejected so the report's step pairing stays correct.
- The phase ends with a report written to `.mini/run/phase-<id>.md` (YAML
  statuses + free text). [`mini done`](done.md) reads that report to move the
  state.
- `--max-turns` must be a positive integer.

## Related

- [`/mini:do`](../interactive/do.md) — interactive variant
- [`mini plan`](plan.md) — comes before
- [`mini done`](done.md) — comes after
