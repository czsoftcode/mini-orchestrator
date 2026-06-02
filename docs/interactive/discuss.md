# `/mini:discuss`

> Discuss the current phase before planning.

**CLI variant:** [`mini discuss`](../non-interactive/discuss.md) — the same
discussion started from a terminal.

## What it does

`/mini:discuss` opens a focused conversation about the **current phase** to
clarify intent before you commit to steps: pin down an ambiguous goal, choose
between directions, surface open questions. The notes are saved into
`.mini/discuss/` and later feed [`/mini:plan`](plan.md) and [`/mini:do`](do.md).

## In a session

1. Claude loads the current phase and project context and runs
   `mini context discuss`.
2. You talk through the intent; Claude asks clarifying questions.
3. The decisions are saved as discussion notes for the phase.

## Example

```text
You:    /mini:discuss
Claude: For "Pagination for /todos" — offset/limit or cursor-based? Any default
        page size? Should the response include a total count?
You:    offset/limit, default 20, include total
Claude: Noted. These notes will guide /mini:plan and /mini:do.
```

## Notes

- Discuss is **optional** — skip it for a straightforward phase and go straight
  to [`/mini:plan`](plan.md).

## Related

- [`mini discuss`](../non-interactive/discuss.md) — CLI variant
- [`/mini:next`](next.md) — comes before
- [`/mini:plan`](plan.md) — comes after
