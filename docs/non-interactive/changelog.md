# `mini changelog`

> Shows the project's `CHANGELOG.md` changes.

**Interactive variant:** [`/mini:changelog`](../interactive/changelog.md) — the
slash command maps its arguments to these calls and relays the output.

## Synopsis

```bash
mini changelog               # the latest released version's section
mini changelog <version>     # the section for a specific version
mini changelog --unreleased  # the pending [Unreleased] section
mini changelog --all         # the whole history
```

## Description

`mini changelog` reads `CHANGELOG.md` and prints a section of it. By default it
prints the latest released version; a `[version]` argument selects a specific
one (an unknown version lists the available ones). It is **read-only**.

## Options

| Flag | Description |
| --- | --- |
| `--all` | Print the whole changelog instead of a single section. |
| `--unreleased` | Print the pending `[Unreleased]` section. |

## Examples

```bash
$ mini changelog
## [1.12.1] — 2026-06-02
### Added
- Project homepage at miniorchestrator.com
…

$ mini changelog 1.12.0
## [1.12.0] — …
…

$ mini changelog 9.9.9
Unknown version 9.9.9. Available: 1.12.1, 1.12.0, 1.11.0, …
```

## Notes

- Read-only — it changes no state.
- An unknown version is not an error; it prints the list of available versions
  so you can pick one.

## Related

- [`/mini:changelog`](../interactive/changelog.md) — interactive variant
- [`mini done`](done.md) — writes new changelog entries when closing a phase
