# `mini verify`

> Opens an interactive Claude Code session for the in-depth UI/UX review of the
> current phase (or the last closed one).

**Interactive variant:** [`/mini:verify`](../interactive/verify.md) — the same
review, started from inside a Claude Code session. This terminal command is the
symmetric counterpart of it (as [`mini discuss`](discuss.md) is to planning).

## Synopsis

```bash
mini verify
```

## Description

`mini verify` opens a Claude Code session that walks a human through an in-depth
UI/UX review of the phase: appearance, CLI/screen output, UX flow, clarity —
things that can only be judged by a person, not mechanically. It targets the
current phase, or the last closed one when no phase is open. The findings are
written into the phase report so they reach the project memory.

It takes no flags — the phase and context come from `.mini/`.

## Example

```bash
$ mini verify
# Opens an interactive Claude Code session that reviews the phase's UI/UX,
# asking one thing at a time. Findings land in the phase report.
```

## Notes

- Verify is **human-driven**. The autonomous loop ([`mini auto`](auto.md)) never
  bypasses it — it stops and lets you review.
- If the review finds problems, the phase is **not** closed: go back to
  [`mini do`](do.md), fix them within the same phase, update the report, and
  only then run [`mini done`](done.md).
- Use it for UI/UX phases; a purely internal phase (refactor, parser, build)
  usually has nothing for a human to look at.

## Related

- [`/mini:verify`](../interactive/verify.md) — interactive variant
- [`mini do`](do.md) — where fixes go back to
- [`mini done`](done.md) — closes the phase after a clean review
