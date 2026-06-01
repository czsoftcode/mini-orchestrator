# Phase 102 — mini changelog --version <v>

**Goal:** Add a '--version <v>' flag to 'mini changelog' (and the /mini:changelog slash command) that prints the section for a specific version; an unknown version is reported with the list of available versions. Reuses the phase-101 section parser.

## Steps
- [done] Version lookup helper + flag
- [done] Command behaviour + tests
- [done] Docs and slash command

## Auto-commit
- Phase 102: mini changelog --version <v>

## Run report
---
phase: 102
verdict: done
steps:
  - title: "Version lookup helper + flag"
    status: done
  - title: "Command behaviour + tests"
    status: done
  - title: "Docs and slash command"
    status: done
---

# Phase 102 — report from the auto session

Let `mini changelog` show a specific version (todo item 6).

## What was done
- **`findVersion(sections, query)`** in `changelog.ts`: matches a section by its
  bracket version, tolerant of a leading `v`; `unreleased` resolves to the
  Unreleased section. Unit tests.
- **`mini changelog <version>`** (`commands/changelog.ts` + `cli.ts`): prints the
  matched section; an unknown version warns and lists the available versions.
  Command tests for a hit, the `v` prefix, and the unknown-version listing.
- **Docs / slash**: `/mini:changelog` argument-hint + body, README table/slash
  list, CHANGELOG `Added` entry.

## Design note (important)
- The todo wording was `--version <v>`, but `--version` **collides with the
  global `-V, --version` flag** (commander printed the package version and
  exited). Switched to a **positional argument** `mini changelog [version]`
  (e.g. `mini changelog 1.11.0`) — cleaner and conflict-free. Docs/CHANGELOG note
  this.

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**815 tests**).
- Smoke test on this project's own changelog: `changelog 1.11.0` and `v1.11.0`
  print that section; `changelog 9.9.9` warns and lists the available versions;
  bare `changelog` still shows the latest released section.
