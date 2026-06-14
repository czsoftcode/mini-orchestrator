# `/mini:verify`

> In-depth UI/UX review of the phase by a human.

**CLI variant:** [`mini verify`](../non-interactive/verify.md) — the same review
started from a terminal.

## What it does

`/mini:verify` walks you through a human review of the phase's **UI/UX** —
appearance, CLI/screen output, UX flow, clarity — the things that can't be
judged mechanically. It targets the current phase, or the last closed one. The
findings are recorded into the durable
[findings store](../non-interactive/findings.md) (`.mini/findings/`) via
`mini findings add --source verify`, so they survive a
corrupt or missing report and a closed phase, and surface later in
[`/mini:next`](next.md).

## In a session

1. Claude reads the `do` report (when present) for context and runs
   `mini context verify`.
2. It takes you through the review **one item at a time**, asking for your
   judgment.
3. It records each finding by calling `mini findings add --source verify`.

## Example

```text
You:    /mini:verify
Claude: Does the paged response read clearly — page, limit, total, items? …
You:    total should be named "totalCount" for consistency
Claude: Recorded as finding 12-1. (Fix it via /mini:do before closing.)
```

## Notes

- Verify is **human-driven**; the autonomous loop never skips it.
- If problems are found, the phase is **not** closed — fix them via
  [`/mini:do`](do.md) within the same phase, then [`/mini:done`](done.md).

## Related

- [`mini verify`](../non-interactive/verify.md) — CLI variant
- [`/mini:do`](do.md) — where fixes go back to
- [`/mini:done`](done.md) — closes the phase after a clean review
