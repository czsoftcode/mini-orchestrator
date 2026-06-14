# `/mini:adversarial-project`

> Independent red-team review of a **range of phases** by a fresh reviewer.

**CLI variant:**
[`mini adversarial-project`](../non-interactive/adversarial-project.md) — the
same review started from a terminal.

## What it does

`/mini:adversarial-project` is the cross-project sibling of
[`/mini:adversarial`](adversarial.md): instead of one phase it red-teams the
combined diff across a **range of phases**. Use it to review a feature that
landed over several phases, or to sweep a stretch of history that was never
independently reviewed. Findings go into the durable
[findings store](../non-interactive/findings.md) (`.mini/findings/`) via
`mini findings add`.

It is **report only**: it never edits code and never moves any phase state.

> **Independence matters.** Either run
> [`mini adversarial-project`](../non-interactive/adversarial-project.md) in a
> **terminal** (it spawns a fresh session), or `/clear` this session first and
> only then run `/mini:adversarial-project`.

## In a session

1. You pass the range as arguments — phase numbers or git refs:
   - `/mini:adversarial-project --from-phase 10 --to-phase 17`
   - `/mini:adversarial-project --from v0.4.0 --to HEAD`
2. The arguments are passed straight through to
   `mini context adversarial-project`, which prints the red-team prompt for the
   selected range. If the range is invalid the command exits non-zero with a
   clear message — Claude relays it and stops.
3. Claude attacks the combined diff and records findings via
   `mini findings add`.

When the start phase is the project's first phase, the range diffs from project
**genesis** (the git empty tree), so the first phase is included in full. See the
[CLI page](../non-interactive/adversarial-project.md) for the full range rules.

## Example

```text
You:    /clear
You:    /mini:adversarial-project --from-phase 162 --to-phase 167
Claude: Reviewing phases 162–167 (the adversarial-project feature). Range start
        falls back to genesis is fine, but … Recorded as finding 167-1.
```

## Notes

- **Report only** — never edits code, never closes phases.
- **Manual-only by design** — there is no `auto`/heuristic wiring; you pick the
  range and start it yourself.

## Related

- [`mini adversarial-project`](../non-interactive/adversarial-project.md) — CLI variant
- [`/mini:adversarial`](adversarial.md) — red-team a single phase
- [`mini findings`](../non-interactive/findings.md) — the store the findings go into
- [`/mini:do`](do.md) — where fixes go back to
