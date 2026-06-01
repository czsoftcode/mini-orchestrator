# Phase 103 — Příkaz mini doctor a /mini:doctor

**Goal:** Add a 'mini doctor' command (and read-only /mini:doctor slash command) that prints a diagnostic checklist of the project setup — state presence and schema version, project.md/CHANGELOG.md presence, installed slash-command count vs expected, and mini version freshness from the cache — each line ok/warn/fail with a fix hint.

## Steps
- [done] Diagnostics model + checks
- [done] doctor command + cli
- [done] /mini:doctor slash command
- [done] README and CHANGELOG

## Auto-commit
- Phase 103: Příkaz mini doctor a /mini:doctor

## Run report
---
phase: 103
verdict: done
steps:
  - title: "Diagnostics model + checks"
    status: done
  - title: "doctor command + cli"
    status: done
  - title: "/mini:doctor slash command"
    status: done
  - title: "README and CHANGELOG"
    status: done
---

# Phase 103 — report from the auto session

Added a project health check (todo item 7).

## What was done
- **Pure `buildDiagnostics(input)`** (`commands/doctor.ts`): turns gathered facts
  into an ordered `DoctorCheck[]` (`{label, status: ok|warn|fail, detail?, hint?}`).
  Checks: project state (missing → `mini init`, legacy schema → `mini migrate`,
  v2 → ok), `project.md` presence, `CHANGELOG.md` presence, installed
  slash-command count vs expected (0 → `install-commands`, fewer → `update`), and
  version freshness via the cache (newer → `mini upgrade`, unknown → ok+hint,
  current → ok). 8 unit tests over the input matrix.
- **`doctor()` command + `cli.ts`**: gathers facts (exists, raw `state.json`
  version, file presence, `*.md` count in `COMMANDS_DIR`, `readPackageVersion`,
  version cache) in parallel, prints the colored checklist (`✓`/`!`/`✗`) with a
  fix hint per non-ok line and a summary. Read-only; exits 0.
- **`/mini:doctor`** read-only slash command; generated-command count bumped
  16 → 17 in install/update/install-commands tests.
- **Docs**: README commands table + slash list + generated file list, CHANGELOG
  `Added` entry.

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**823 tests**).
- Smoke tests: in the mini repo `mini doctor` reports all ok except the expected
  project-scope slash-commands warning (this repo uses the user scope); in an
  empty dir it reports the missing project (`✗`) plus warnings and exits 0.
