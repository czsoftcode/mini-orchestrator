# `mini upgrade`

> Checks npm for a newer `mini-orchestrator` and installs it.

**Interactive variant:** [`/mini:upgrade`](../interactive/upgrade.md) — the slash
command checks first, asks you to confirm, and only then installs with `--yes`.

## Synopsis

```bash
mini upgrade          # interactive: reports current → latest, asks before installing
mini upgrade --check  # only check and report; install nothing
mini upgrade --yes    # install the latest non-interactively
```

## Description

`mini upgrade` compares the installed version with the latest published on npm
and, with your approval, installs it globally
(`npm install -g mini-orchestrator@latest`). Run bare it reports current →
latest and asks before installing; `--check` only reports; `--yes` installs
without a prompt.

## Options

| Flag | Description |
| --- | --- |
| `--check` | Only check and report the latest published version; do not install. |
| `--yes` | Skip the confirmation and install directly (non-interactive). |

## Examples

```bash
$ mini upgrade --check
Current: 1.12.1
Latest:  1.13.0
A newer version is available. Install with: mini upgrade --yes

$ mini upgrade --yes
[ok] Installed mini-orchestrator@1.13.0
```

## Notes

- **Don't run a bare `mini upgrade` in a non-interactive shell** — it blocks on
  the confirmation prompt. Use `--check` then `--yes`.
- If `--check` reports a **local dev build** (not a global npm install), it
  won't try to upgrade — update with `git pull && npm run install-local`
  instead.

## Related

- [`/mini:upgrade`](../interactive/upgrade.md) — interactive variant
- [`mini doctor`](doctor.md) — flags an out-of-date mini in its checklist
