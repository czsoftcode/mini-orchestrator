# `mini plan`

> Breaks the current phase down into concrete steps.

**Interactive variant:** [`/mini:plan`](../interactive/plan.md) — the slash
command proposes the steps in the session and then calls this with `--apply`.

## Synopsis

```bash
mini plan                       # interactive: Claude proposes the steps
printf '%s\n' "title :: detail" "title only" | mini plan --apply
```

## Description

A plan turns the phase goal into 3–7 concrete, verifiable steps. Each step has a
**title** (its stable identifier, paired with the report) and an optional
**detail** (the verifiable output and criteria). Run bare, `mini plan` opens a
Claude session that proposes the steps. With `--apply` it reads steps from
**stdin**, one per line, and saves them onto the current phase (moving it to
`planned`).

## Options

| Flag | Description |
| --- | --- |
| `--apply` | Non-interactively save steps read from stdin (no Claude). |

With `--apply`, each stdin line is one step in the form `title :: detail`. The
` :: ` separator is optional — a line without it is just a title.

## Example

```bash
$ printf '%s\n' \
    "JSON status builder :: Pure function status->object; covered by a unit test." \
    "--json flag wiring :: mini status --json prints the object to stdout, no decoration." \
    "README and CHANGELOG" | mini plan --apply
[ok] Phase 12 broken down into 3 steps.
```

## Notes

- The step titles are the canonical names used by [`mini do`](do.md)
  (`--step-done "<title>"`) and by the report's YAML. Keep them concise and
  stable; renaming a step later would break the pairing.
- A phase that already has steps is skipped by the autonomous loop — re-plan
  only deliberately.

## Related

- [`/mini:plan`](../interactive/plan.md) — interactive variant
- [`mini discuss`](discuss.md) — optional step before
- [`mini do`](do.md) — comes after
