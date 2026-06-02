# `mini discuss`

> Opens an interactive Claude Code session focused on the current phase — lets
> you discuss the intent before planning.

**Interactive variant:** [`/mini:discuss`](../interactive/discuss.md) — the same
discussion, started from inside a Claude Code session.

## Synopsis

```bash
mini discuss
```

## Description

`mini discuss` opens a Claude Code session scoped to the **current phase**. It is
the place to clarify intent before committing to steps: pin down an ambiguous
goal, choose between directions, surface open questions. The notes from the
discussion are saved into `.mini/discuss/` and are later fed into
[`mini plan`](plan.md) and [`mini do`](do.md), so the decisions reach the
implementation.

It takes no flags — the current phase and project context are read from
`.mini/`.

## Example

```bash
$ mini discuss
# Opens an interactive Claude Code session for the current phase.
# Discuss the intent; the notes are saved to .mini/discuss/.
```

## Notes

- Discuss is **optional**. Skip it for a straightforward phase and go straight
  to [`mini plan`](plan.md).
- The discussion notes are loaded once and shared across the later steps of the
  same phase, so they are not re-read on every command.

## Related

- [`/mini:discuss`](../interactive/discuss.md) — interactive variant
- [`mini next`](next.md) — comes before
- [`mini plan`](plan.md) — comes after
