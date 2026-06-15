# `mini security`

> Opens a fresh Claude Code session for an independent **security review** of a
> phase or a range of phases.

**Interactive variant:**
[`/mini:security`](../interactive/security.md) — the same review, started from
inside a Claude Code session.

## Synopsis

```bash
mini security                                   # the last completed phase
mini security [--from-phase <n> --to-phase <n>] # a range, by phase number
mini security [--from <ref> --to <ref>]         # a range, by git ref
```

## Description

`mini security` audits the code produced by a phase (or a range of phases)
through a **security lens only** — injection, auth/authz, secret handling, path
traversal, unsafe deserialization, SSRF and the like — not for correctness. It is
the security sibling of the correctness red-team
[`mini adversarial`](adversarial.md) / [`mini adversarial-project`](adversarial-project.md),
and a deliberately **separate, dedicated pass**.

It is **report only**: the reviewer writes a standalone Markdown report and
**never edits code**, **never moves any phase state**, and does **not** file into
the [findings store](findings.md) — security stays its own output by design.

A **fresh terminal session** gives the reviewer independence from whoever wrote
the code, and lets `mini security` enforce a scoped tool set (see below).

### Selecting what to review

| Invocation | What is reviewed |
| --- | --- |
| _(no flags)_ | The **last completed (`done`) phase**, from its pre-commit SHA to `HEAD`. |
| `--from-phase <n> --to-phase <n>` | A range given by phase numbers. |
| `--from <ref> --to <ref>` | A range given by git refs. |

The phase and ref forms **cannot be mixed**. With no flags, an in-progress phase
is skipped — only a `done` phase is reviewed; if none is completed yet, the
command exits non-zero.

The start of a phase range is the commit **before** the start phase's first
commit, so the diff includes everything that phase changed; when the start phase
is the project's very first phase, the range falls back to the **git empty tree**
(project genesis), so the first phase is included in full.

> **Phase-mode range end.** `--from-phase A --to-phase B` bounds the end of phase
> `B` with the **next** phase's pre-commit SHA. If phase `B+1` does not exist yet
> or has no recorded `preSha` (e.g. it is the current in-progress phase), the
> command exits non-zero — this is the same range behaviour as
> [`mini adversarial-project`](adversarial-project.md). To review a just-finished
> phase, close it with [`mini done`](done.md) first and run `mini security` with
> no flags (which uses the `preSha`→`HEAD` path instead).

If the range is invalid (mixed flag forms, an unknown phase, a missing bound, an
unknown ref, or a non-first start phase with no `preSha`), the command exits
non-zero with a clear message — relay it and stop.

### The report

The reviewer writes one Markdown report; its path is derived from what you
reviewed:

| Invocation | Report path |
| --- | --- |
| _(no flags)_ | `.mini/security/phase-<id>.md` |
| `--from-phase A --to-phase B` | `.mini/security/range-<A>-<B>.md` |
| `--from <ref> --to <ref>` | `.mini/security/range-<short>-<short>.md` (resolved short SHAs) |

Re-running the same range **overwrites** the prior report at that path.

### Scoped tool set

Started from a terminal, `mini security` runs the session with a restricted tool
set: read + search tools, **read-only** git (`git diff`/`log`/`show`), and a
single `Write` confined to `Write(.mini/security/**)`. There is no `Edit`, so the
reviewer cannot touch a source file, and no `mini findings` write. A write outside
`.mini/security/` is **not hard-blocked** — Claude falls back to asking you, which
is the safety net should a prompt-injection in the reviewed diff try to steer a
write elsewhere.

## Example

```bash
# Security-review the last completed phase:
$ mini security

# Review everything phases 10 through 17 changed:
$ mini security --from-phase 10 --to-phase 17

# Same idea, but by git ref:
$ mini security --from v0.4.0 --to HEAD
```

## Notes

- **Report only.** Writes `.mini/security/<range>.md`; never edits code, never
  closes phases, never files into `mini findings`.
- **Separate from the correctness review.** Run it in addition to
  [`mini adversarial`](adversarial.md) / `mini adversarial-project`, not instead
  of them.
- **Manual-only by design.** There is no `auto`/heuristic wiring — you pick the
  target and start it yourself.

## Related

- [`/mini:security`](../interactive/security.md) — interactive variant
- [`mini adversarial`](adversarial.md) — red-team a single phase (correctness)
- [`mini adversarial-project`](adversarial-project.md) — red-team a range (correctness)
- [`mini done`](done.md) — close a phase before reviewing it with no flags
