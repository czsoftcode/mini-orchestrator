# `/mini:security`

> Independent **security review** of a phase or a range of phases.

**CLI variant:**
[`mini security`](../non-interactive/security.md) — the same review started from a
terminal (with a scoped tool set).

## What it does

`/mini:security` audits the code through a **security lens only** — injection,
auth/authz, secret handling, path traversal, unsafe deserialization, SSRF and the
like — not for correctness. It is the security sibling of
[`/mini:adversarial`](adversarial.md) / [`/mini:adversarial-project`](adversarial-project.md),
and a deliberately **separate, dedicated pass**.

With no flags it reviews the **last completed (`done`) phase**; range flags review
a span. The reviewer writes a standalone Markdown report to
`.mini/security/<range>.md` and does **not** file into the
[findings store](../non-interactive/findings.md) — security stays its own output
by design.

It is **report only**: it never edits code and never moves any phase state.

> **Independence and scope — read this.** Run as a slash command, the review
> happens **inline in this very session**, so the "reviewer" shares the context
> and blind spots of whoever wrote the code. On top of that, the scoped tool set
> the terminal [`mini security`](../non-interactive/security.md) enforces
> (read-only tools + a `Write` confined to `.mini/security/`) does **not** apply
> inline — here the review runs with this session's own permissions. So the slash
> command is a convenience, **not** an isolated, scoped audit. For a genuinely
> independent and scoped review, either run
> [`mini security`](../non-interactive/security.md) in a **terminal** (it spawns a
> fresh session with the scoped tools), or `/clear` this session first and only
> then run `/mini:security`.

## In a session

1. You pick what to review via arguments (or none for the last completed phase):
   - `/mini:security`
   - `/mini:security --from-phase 10 --to-phase 17`
   - `/mini:security --from v0.4.0 --to HEAD`
2. The arguments are passed straight through to `mini context security`, which
   prints the security-review prompt for the selected target (the report path is
   embedded in it). If the range is invalid the command exits non-zero with a
   clear message — Claude relays it and stops.
3. Claude audits the diff and writes the report to `.mini/security/<range>.md`.

The phase and ref forms cannot be mixed. With no flags an in-progress phase is
skipped — only a `done` phase is reviewed. See the
[CLI page](../non-interactive/security.md) for the full range rules, the report
naming scheme, and the phase-mode range-end caveat.

## Example

```text
You:    /clear
You:    /mini:security
Claude: Security-reviewing phase 171 (preSha→HEAD). Wrote findings to
        .mini/security/phase-171.md — no exploitable issues, two hardening notes.
```

## Notes

- **Report only** — never edits code, never closes phases, never files into
  `mini findings`.
- **Separate from the correctness review** — run it in addition to
  `/mini:adversarial(-project)`, not instead of them.
- **Manual-only by design** — there is no `auto`/heuristic wiring; you pick the
  target and start it yourself.

## Related

- [`mini security`](../non-interactive/security.md) — CLI variant (scoped tools)
- [`/mini:adversarial`](adversarial.md) — red-team a single phase (correctness)
- [`/mini:adversarial-project`](adversarial-project.md) — red-team a range (correctness)
- [`/mini:done`](done.md) — close a phase before reviewing it with no flags
