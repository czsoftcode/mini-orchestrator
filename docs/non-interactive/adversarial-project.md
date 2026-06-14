# `mini adversarial-project`

> Opens a fresh Claude Code session for an independent red-team review of a
> **range of phases** — not just the current one.

**Interactive variant:**
[`/mini:adversarial-project`](../interactive/adversarial-project.md) — the same
review, started from inside a Claude Code session.

## Synopsis

```bash
mini adversarial-project [--from-phase <n> --to-phase <n>]
mini adversarial-project [--from <ref> --to <ref>]
```

## Description

`mini adversarial-project` is the cross-project sibling of
[`mini adversarial`](adversarial.md): instead of one phase, it red-teams the
combined diff produced **across a range of phases**. Use it to review a whole
feature that landed over several phases, or to sweep a stretch of history that
was never independently reviewed.

Like the single-phase command it is **report only** — findings go into the
durable [findings store](findings.md) (`.mini/findings/`) via
`mini findings add`, the review **never edits code**, and it **never moves any
phase state**.

### Selecting the range

The range is given **either** by phase numbers **or** by git refs — the two
forms cannot be mixed:

| Flag | Meaning |
| --- | --- |
| `--from-phase <n>` | Range start as a phase number (use with `--to-phase`). |
| `--to-phase <n>` | Range end as a phase number (use with `--from-phase`). |
| `--from <ref>` | Range start as a git ref (use with `--to`; cannot mix with the phase flags). |
| `--to <ref>` | Range end as a git ref (use with `--from`; cannot mix with the phase flags). |

The start of a phase range is the commit **before** the start phase's first
commit, so the diff includes everything that phase changed. When the start phase
is the project's very first phase (there is no earlier phase to anchor to), the
range falls back to the **git empty tree** — i.e. it diffs from project genesis,
so the first phase is included in full.

If the range is invalid (mixed flag forms, an unknown phase, or a start phase
whose pre-commit SHA is missing and is not the first phase), the command exits
non-zero with a clear message — relay it and stop.

Run it from a **fresh** terminal session (clean context) so the reviewer is
independent of whatever wrote the code.

## Example

```bash
# Red-team everything phases 10 through 17 changed:
$ mini adversarial-project --from-phase 10 --to-phase 17

# Same idea, but by git ref:
$ mini adversarial-project --from v0.4.0 --to HEAD
```

## Notes

- **Report only.** Records findings via `mini findings add`; never edits code,
  never closes phases.
- **Manual-only by design.** There is no `auto`/heuristic wiring — you pick the
  range and start it yourself.
- The findings carry a `--source` of `adversarial`, the same store the
  single-phase review uses; review them with [`mini findings list`](findings.md).

## Related

- [`/mini:adversarial-project`](../interactive/adversarial-project.md) — interactive variant
- [`mini adversarial`](adversarial.md) — red-team a single phase
- [`mini findings`](findings.md) — the store the findings go into
- [`mini do`](do.md) — where fixes go back to
