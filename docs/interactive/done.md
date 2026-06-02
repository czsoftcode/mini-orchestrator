# `/mini:done`

> Human verification and moving the phase state forward.

**CLI variant:** [`mini done`](../non-interactive/done.md) — the terminal command
this slash command calls with `--apply` (plus any version switches).

## What it does

`/mini:done` closes the current phase: it confirms the work, then moves the phase
and its steps to their final state, commits the changes, and optionally bumps the
version and pushes — based on the report from [`/mini:do`](do.md).

## In a session

1. Claude runs `mini context done`, reviews the report, and confirms with you
   that the phase works.
2. It closes the phase with `mini done --apply`, appending any version switches
   (`--bump <level>`, `--push`) you asked for.
3. Items flagged for **manual verification** stop the close — Claude lets you
   verify them first (it does not bypass them).

## Example

```text
You:    /mini:done
Claude: Phase 12 report looks complete. Close it with a patch bump?
You:    yes
Claude: [mini done --apply --bump patch] Phase 12 closed, version → 1.12.1.
```

## Notes

- `--push` (a release) requires an explicit `--bump patch | minor | major` — it
  also creates the version tag, so `--bump none` with push makes no sense.
- Regret a close? [`/mini:undo`](undo.md) reverts the last state change by one
  step.

## Related

- [`mini done`](../non-interactive/done.md) — CLI variant
- [`/mini:do`](do.md) — produces the report this reads
- [`/mini:verify`](verify.md) — human review before closing
- [`/mini:undo`](undo.md) — revert a close
