# `mini adversarial`

> Opens a fresh Claude Code session for an independent red-team review of the
> current phase (or the last closed one).

**Interactive variant:** [`/mini:adversarial`](../interactive/adversarial.md) —
the same review, started from inside a Claude Code session. This terminal
command is the symmetric counterpart of it (as [`mini verify`](verify.md) is to
the human UI/UX review).

## Synopsis

```bash
mini adversarial
```

## Description

`mini adversarial` opens a **fresh** Claude Code session (clean context) whose
job is to *break* the code the phase produced — not to confirm it works. An
independent reviewer red-teams the diff: unhappy paths, bad/empty/oversized
input, null/undefined, timeouts, swallowed errors, race conditions. It targets
the current phase, or the last closed one when no phase is open.

It is **report only**: findings are recorded into the durable
[findings store](findings.md) (`.mini/findings/`) via
`mini findings add --source adversarial`, so they survive a corrupt or missing
report and a closed phase, and surface later in [`mini next`](next.md). The
review **never edits code** and **never moves the phase state** — closing a
phase stays a human decision in [`mini done`](done.md).

It takes no flags — the phase and context come from `.mini/`. To review more
than one phase at once, use [`mini adversarial-project`](adversarial-project.md).

A fresh session matters: run it in a terminal (this command spawns a clean
context), or `/clear` first and then run the slash variant — otherwise the
reviewer inherits the context that produced the code and is no longer
independent.

## Example

```bash
$ mini adversarial
# Opens an independent Claude Code session that red-teams the phase's diff
# and records what it finds via `mini findings add --source adversarial`.
```

## Notes

- **Independent by design.** The value comes from a clean context — don't run it
  in the same session that wrote the code.
- **Report only.** It records findings; it never edits code and never closes the
  phase. Fix findings via [`mini do`](do.md), then [`mini done`](done.md).
- **Manual-only.** There is no `auto`/heuristic wiring — you start it yourself.

## Related

- [`/mini:adversarial`](../interactive/adversarial.md) — interactive variant
- [`mini adversarial-project`](adversarial-project.md) — red-team a range of phases
- [`mini findings`](findings.md) — the store the findings go into
- [`mini verify`](verify.md) — the human UI/UX counterpart
- [`mini do`](do.md) — where fixes go back to
