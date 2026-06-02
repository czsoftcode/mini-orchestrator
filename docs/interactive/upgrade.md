# `/mini:upgrade`

> Check npm for a newer mini-orchestrator and install it.

**CLI variant:** [`mini upgrade`](../non-interactive/upgrade.md) — incl. the
`--check` and `--yes` forms.

## What it does

`/mini:upgrade` checks npm for a newer `mini-orchestrator` and, with your
approval, installs it globally. The slash command always checks first and asks
before installing — it never runs a bare `mini upgrade` (which would block on a
prompt in the non-interactive Bash).

## In a session

1. **Check** — Claude runs `mini upgrade --check` and relays current → latest.
2. **Confirm** — if a newer version exists, it asks whether to install and
   **waits for your answer**.
3. **Apply** — only after you confirm, it runs `mini upgrade --yes`.

> If `--check` reports a **local dev build** (not a global npm install), Claude
> won't try to upgrade — it relays the hint to update via
> `git pull && npm run install-local` instead.

## Example

```text
You:    /mini:upgrade
Claude: [mini upgrade --check] Current 1.12.1 → latest 1.13.0. Install now?
You:    yes
Claude: [mini upgrade --yes] Installed mini-orchestrator@1.13.0.
```

## Related

- [`mini upgrade`](../non-interactive/upgrade.md) — CLI variant
- [`/mini:doctor`](doctor.md) — flags an out-of-date mini in its checklist
