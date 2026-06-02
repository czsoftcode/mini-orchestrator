# `/mini:verify`

> In-depth UI/UX review of the phase by a human.

**CLI variant:** [`mini verify`](../non-interactive/verify.md) — the same review
started from a terminal.

## What it does

`/mini:verify` walks you through a human review of the phase's **UI/UX** —
appearance, CLI/screen output, UX flow, clarity — the things that can't be
judged mechanically. It targets the current phase, or the last closed one. The
findings are written into the phase report, so they reach the project memory.

## In a session

1. Claude leaves the `do` report in place and runs `mini context verify`.
2. It takes you through the review **one item at a time**, asking for your
   judgment.
3. It records the findings into the report.

## Example

```text
You:    /mini:verify
Claude: Does the paged response read clearly — page, limit, total, items? …
You:    total should be named "totalCount" for consistency
Claude: Noted as a finding. (Fix it via /mini:do before closing.)
```

## Notes

- Verify is **human-driven**; the autonomous loop never skips it.
- If problems are found, the phase is **not** closed — fix them via
  [`/mini:do`](do.md) within the same phase, update the report, then
  [`/mini:done`](done.md).

## Related

- [`mini verify`](../non-interactive/verify.md) — CLI variant
- [`/mini:do`](do.md) — where fixes go back to
- [`/mini:done`](done.md) — closes the phase after a clean review
