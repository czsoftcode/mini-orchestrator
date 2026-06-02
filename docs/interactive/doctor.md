# `/mini:doctor`

> Health check of the project setup (read-only).

**CLI variant:** [`mini doctor`](../non-interactive/doctor.md) — the full
checklist reference.

## What it does

`/mini:doctor` runs `mini doctor` and relays its health-check checklist into the
chat: the state file and schema version, `project.md`/`CHANGELOG.md`, the
installed slash commands, and the mini version freshness. For anything flagged,
Claude also mentions the suggested fix. It is **read-only**.

## In a session

1. Claude runs `mini doctor` in Bash.
2. It relays the checklist, and when a line is flagged it points out the fix
   command (e.g. `mini update`, [`/mini:upgrade`](upgrade.md)).

## Example

```text
You:    /mini:doctor
Claude: [mini doctor]
        [ok]   State file, schema v2
        [warn] Slash commands out of date → run: mini update
        [ok]   mini 1.12.1 (latest)
```

## Related

- [`mini doctor`](../non-interactive/doctor.md) — CLI variant
- [`/mini:upgrade`](upgrade.md) — when mini itself is out of date
- [`/mini:status`](status.md) — phase overview
