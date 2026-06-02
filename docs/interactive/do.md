# `/mini:do`

> Implement the current phase and write a report.

**CLI variant:** [`mini do`](../non-interactive/do.md) — the terminal command;
the slash command uses its `--apply` forms for state tracking.

## What it does

`/mini:do` implements the current phase **in the session you are in** — Claude
writes the code itself, tracks step progress, and ends with a report. (This is
different from the terminal `mini do`, which spawns a *separate* Claude session.)

## In a session

1. Claude runs `mini do --apply` to mark the phase `doing` and create
   `.mini/run/`.
2. It runs `mini context do` to load the project context, the steps, and the
   report format.
3. It implements the steps, marking each done immediately with
   `mini do --apply --step-done "<exact step name>"`.
4. At the end it writes the report to `.mini/run/phase-<id>.md` (YAML statuses +
   free text), which [`/mini:done`](done.md) later reads.

## Example

```text
You:    /mini:do
Claude: [mini do --apply] Phase 12 in progress.
        [implements step 1] → mini do --apply --step-done "Parse ?page/?limit…"
        [implements step 2, 3] … report written to .mini/run/phase-12.md.
        Next: /mini:done.
```

## Notes

- If a step hits a blocker Claude can't get around, it stops and hands control
  back to you rather than forcing the rest.

## Related

- [`mini do`](../non-interactive/do.md) — CLI variant
- [`/mini:plan`](plan.md) — comes before
- [`/mini:done`](done.md) — comes after
