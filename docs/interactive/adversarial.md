# `/mini:adversarial`

> Independent red-team review of the current phase by a fresh reviewer.

**CLI variant:** [`mini adversarial`](../non-interactive/adversarial.md) — the
same review started from a terminal.

## What it does

`/mini:adversarial` runs an **independent** reviewer over the code the phase
produced (or the last closed phase when none is open) — its job is to *break*
the code, not to confirm it works: unhappy paths, bad/empty/oversized input,
null/undefined, timeouts, swallowed errors. Findings are recorded into the
durable [findings store](../non-interactive/findings.md) (`.mini/findings/`) via
`mini findings add --source adversarial`, so they survive a corrupt or missing
report and a closed phase, and surface later in [`/mini:next`](next.md).

It is **report only**: it never edits code and never moves the phase state —
closing a phase stays a human decision in [`/mini:done`](done.md).

> **Independence matters.** For the review to be honest, the reviewer must not
> inherit the context that wrote the code. Either run
> [`mini adversarial`](../non-interactive/adversarial.md) in a **terminal** (it
> spawns a fresh session), or `/clear` this session first and only then run
> `/mini:adversarial`.

## In a session

1. Claude runs `mini context adversarial` to load the red-team prompt for the
   target phase.
2. It attacks the diff and writes each finding via
   `mini findings add --source adversarial`.
3. It reports a status (`adversarial: pass | findings | blocked`) — but does
   **not** close the phase.

## Example

```text
You:    /clear
You:    /mini:adversarial
Claude: Reviewing phase 42. resolvePhaseRange throws an opaque TypeError on a
        malformed state.json (no shape check). Recorded as finding 42-1.
```

## Notes

- **Report only** — it never edits code. Fix findings via [`/mini:do`](do.md),
  then [`/mini:done`](done.md).
- **Manual-only** — there is no `auto`/heuristic wiring; you start it yourself.
- To review several phases at once, use
  [`/mini:adversarial-project`](adversarial-project.md).

## Related

- [`mini adversarial`](../non-interactive/adversarial.md) — CLI variant
- [`/mini:adversarial-project`](adversarial-project.md) — red-team a range of phases
- [`mini findings`](../non-interactive/findings.md) — the store the findings go into
- [`/mini:verify`](verify.md) — the human UI/UX counterpart
- [`/mini:do`](do.md) — where fixes go back to
