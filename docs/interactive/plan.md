# `/mini:plan`

> Break the current phase down into concrete steps.

**CLI variant:** [`mini plan`](../non-interactive/plan.md) — saves steps from
stdin; this slash command proposes them first.

## What it does

`/mini:plan` turns the current phase's goal into 3–7 concrete, verifiable steps.
Each step has a **title** (its stable identifier) and an optional **detail** (the
verifiable output and criteria). After you approve, it saves them onto the phase.

## In a session

1. Claude reads the phase (and any discussion notes) and runs
   `mini context plan`.
2. It proposes the steps and shows them to you briefly.
3. After you approve, it saves them by piping `title :: detail` lines into
   `mini plan --apply`, then tells you to continue with [`/mini:do`](do.md).

## Example

```text
You:    /mini:plan
Claude: Steps for "Pagination for /todos":
        1. Parse ?page/?limit with defaults  2. Page the query + total count
        3. Test the paged response. Save these?
You:    yes
Claude: [pipes the steps into mini plan --apply] Saved 3 steps. Next: /mini:do.
```

## Notes

- The step titles become the names used by [`/mini:do`](do.md) and the report —
  keep them stable, don't rename mid-phase.

## Related

- [`mini plan`](../non-interactive/plan.md) — CLI variant
- [`/mini:discuss`](discuss.md) — optional step before
- [`/mini:do`](do.md) — comes after
