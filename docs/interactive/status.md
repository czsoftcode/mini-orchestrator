# `/mini:status`

> Overview of the project phases (read-only).

**CLI variant:** [`mini status`](../non-interactive/status.md) — incl. the
`--json` machine-readable form.

## What it does

`/mini:status` runs `mini status` and relays the phase overview into the chat:
the project header (name, what, models) and the list of phases with their status
and duration. It is **read-only** — it changes no state and saves nothing.

## In a session

1. Claude runs `mini status` in Bash.
2. It relays the output into the chat.

## Example

```text
You:    /mini:status
Claude: mini orchestrator …
        [done] 1. Test infrastructure (took 3m 29s)
        … Next: mini next.
```

## Related

- [`mini status`](../non-interactive/status.md) — CLI variant (incl. `--json`)
- [`/mini:doctor`](doctor.md) — health check of the setup
- [`/mini:changelog`](changelog.md) — released changes
