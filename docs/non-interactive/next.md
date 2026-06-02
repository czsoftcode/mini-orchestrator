# `mini next`

> Proposes what should come as the next phase.

**Interactive variant:** [`/mini:next`](../interactive/next.md) — the slash
command proposes a phase in the session (using your idea or the
[todo](todo.md) archive) and then calls this with `--apply` to save it.

## Synopsis

```bash
mini next                                   # interactive: Claude proposes a phase
mini next --apply --title "…" --goal "…"    # non-interactively save a phase
```

## Description

A phase is the unit of work in mini: one small, verifiable goal (1–3 days). Run
bare, `mini next` opens a Claude session that looks at the project and progress
so far and proposes one next phase. With `--apply` it just writes a phase you
already have a title and goal for — no Claude involved — and sets it as the
current phase in `proposed` state.

## Options

| Flag | Description |
| --- | --- |
| `--apply` | Non-interactively save a phase from `--title`/`--goal` (no Claude). |
| `--title <title>` | Title of the new phase. **Required with `--apply`.** |
| `--goal <goal>` | Goal of the new phase (one clear, verifiable sentence). **Required with `--apply`.** |

## Examples

```bash
$ mini next --apply \
    --title "Pagination for /todos" \
    --goal "GET /todos accepts ?page and ?limit and returns a paged result; covered by a test."
[ok] Added: phase 12 — Pagination for /todos
```

## Notes

- After saving, the phase is in `proposed` state. Continue with
  [`mini discuss`](discuss.md) (clarify first) or [`mini plan`](plan.md) (break
  it into steps).
- The open items in the [todo](todo.md) archive are offered by the interactive
  variant as candidate ideas — a place to park ideas you don't want to start
  yet.

## Related

- [`/mini:next`](../interactive/next.md) — interactive variant
- [`mini plan`](plan.md) — next step in the loop
- [`mini todo`](todo.md) — idea backlog that feeds `next`
