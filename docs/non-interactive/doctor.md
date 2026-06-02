# `mini doctor`

> Quick health check of the project setup.

**Interactive variant:** [`/mini:doctor`](../interactive/doctor.md) — the slash
command runs this and relays the checklist, mentioning the fix for anything
flagged.

## Synopsis

```bash
mini doctor
```

## Description

`mini doctor` prints a health-check checklist of the project setup and, for
anything that isn't ok, a hint on how to fix it. It checks:

- the state file and its **schema version**,
- the presence of `project.md` and `CHANGELOG.md`,
- the **installed slash commands** (`.claude/commands/mini/*.md`),
- the **mini version freshness** (whether a newer release is available).

It is **read-only** and takes no flags.

## Example

```bash
$ mini doctor
mini doctor
  [ok]   State file (.mini/state.json), schema v2
  [ok]   project.md present
  [ok]   CHANGELOG.md present
  [warn] Slash commands out of date → run: mini install-commands
  [ok]   mini 1.12.1 (latest)
```

## Notes

- Read-only — it changes no state.
- When something is flagged, the line includes the suggested fix command (e.g.
  `mini install-commands`, [`mini upgrade`](upgrade.md)).

## Related

- [`/mini:doctor`](../interactive/doctor.md) — interactive variant
- [`mini upgrade`](upgrade.md) — when mini itself is out of date
- [`mini status`](status.md) — phase overview
