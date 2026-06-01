---
phase: 101
verdict: done
steps:
  - title: "Changelog section parser"
    status: done
  - title: "mini changelog command"
    status: done
  - title: "/mini:changelog slash command"
    status: done
  - title: "README and CHANGELOG"
    status: done
---

# Phase 101 — report from the auto session

Added a way to read the project's changelog from the CLI (todo item 6).

## What was done
- **Parser** (`changelog.ts`): `parseChangelogSections(content)` splits the file
  into `## [...]` sections `{heading, version, released, body}` (ignoring the
  intro), plus `latestReleased()` and `unreleasedSection()` selectors. Unit tests.
- **`mini changelog`** (`commands/changelog.ts` + `cli.ts`): bare → the latest
  released (dated) section; `--unreleased` → the pending `[Unreleased]` section;
  `--all` → the whole file. A missing `CHANGELOG.md` is reported gracefully; with
  no released version yet it falls back to Unreleased. Independent of `.mini/`
  state. Unit tests (temp dir, captured output) for each mode.
- **`/mini:changelog`** (`install/commands.ts`): a read-only slash command (own
  body like `status`) mapping `--all` / `--unreleased`. Generated-command count
  bumped 15 → 16 in install/update/install-commands tests.
- **Docs**: README commands table + slash list + generated file list, and a
  CHANGELOG `Added` entry.

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**808 tests**).
- Smoke test on this project's own `CHANGELOG.md`: default prints the latest dated
  section (`[1.10.0]`, since the 1.10.1-4 patches accumulate under Unreleased per
  the changelog convention); `--unreleased` prints the pending section including
  the new `mini changelog` entry; `--all` prints everything.

## Notes
- Default intentionally shows the latest *released* (dated) section, matching the
  project's convention that patches stay in Unreleased until a minor/major release
  stamps them. After this phase's minor release, default will show the new version.
