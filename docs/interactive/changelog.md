# `/mini:changelog`

> Show the project `CHANGELOG.md` changes (read-only).

**CLI variant:** [`mini changelog`](../non-interactive/changelog.md) — the full
flag reference.

**Argument hint:** `[<version> | --all | --unreleased]`

## What it does

`/mini:changelog` shows a section of the project's `CHANGELOG.md`. It maps your
arguments to a `mini changelog` call and relays the output. It is **read-only**.

## In a session

| You type | Claude runs |
| --- | --- |
| nothing | `mini changelog` (latest released version) |
| `<version>` (e.g. `1.12.0`) | `mini changelog <version>` |
| `--unreleased` | `mini changelog --unreleased` (pending section) |
| `--all` | `mini changelog --all` (whole history) |

## Example

```text
You:    /mini:changelog --unreleased
Claude: [mini changelog --unreleased]
        ## [Unreleased]
        ### Added
        - Per-command documentation under docs/
```

## Related

- [`mini changelog`](../non-interactive/changelog.md) — CLI variant
- [`/mini:done`](done.md) — writes changelog entries when closing a phase
