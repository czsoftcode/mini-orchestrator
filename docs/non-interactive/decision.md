# `mini decision`

> Writes the current phase's decision record (ADR) to `.mini/decisions/` from stdin.

**Interactive variant:** none of its own — this command is driven by
[`/mini:done`](../interactive/done.md), which drafts the ADR in the session,
gets the user's approval, and then calls this with `--apply`.

## Synopsis

```bash
printf '%s\n' "# Title" "" "## Decision" "…" "" "## Why" "…" | mini decision --apply
```

## Description

A decision record (ADR) captures the **why** behind a phase — a non-trivial call
where a concrete alternative was weighed and rejected, and the choice would not
be obvious from the code later. It is stored as a single markdown file
`.mini/decisions/phase-XXX.md` bound to the current phase, where the **file's
existence is the only source of truth** (there is no flag in `state.json`).

`mini decision --apply` reads the ADR body from **stdin** and writes it for the
**current** phase (`currentPhaseId`). It must therefore run **before**
[`mini done --apply`](done.md) — once `done` closes the phase, the current phase
points to the next one, and the `done` phase commit picks up the decision file
only if it already exists on disk.

The body stays free markdown; only a top-level `# ` heading is required. The
conventional shape is `# <title>` + `## Decision` + `## Why`.

## Options

| Flag | Description |
| --- | --- |
| `--apply` | Write the ADR body read from stdin (required — there is no interactive mode). |

## Guards — when nothing is written

The command writes **nothing** (and exits non-zero) when:

- **stdin is empty / whitespace only** — "no decision" is represented by the
  *absence* of the file, never by an empty file. A phase with no real crossroads
  simply keeps no ADR; just run `mini done --apply`.
- **the body has no top-level `# ` heading** — guards against a malformed body.

An existing decision file for the phase is **overwritten** (e.g. a repeated
`/mini:done` after a verification fix).

## Example

```bash
$ printf '%s\n' \
    "# Warn, do not error on orphaned phases" \
    "" \
    "## Decision" \
    "Doctor reports an orphaned 'doing' phase as a warning, not a hard error." \
    "" \
    "## Why" \
    "Erroring would block the whole check; an orphan is a legitimate mid-phase state." \
    | mini decision --apply
[ok] Decision record saved for phase 125 (Doctor: orphaned phases & reports).
  It will land in the phase commit on mini done --apply.
```

## Notes

- The ADR is **not** the CHANGELOG: the CHANGELOG records *what* changed for
  users, the ADR records *why* a technical path was chosen. Don't duplicate.
- Surfacing an existing ADR is done by [`mini status --phase <n>`](status.md);
  the doctor orphan-check and `mini undo` handling of decision files are separate
  follow-ups.

## Related

- [`/mini:done`](../interactive/done.md) — drives this command
- [`mini done`](done.md) — must run *after* `mini decision --apply`
- [`mini status`](status.md) — `--phase <n>` shows a phase's ADR
