# Phase 179 — Allow project finding source in CLI

**Goal:** Add 'project' to the --source choices and help text of the 'mini findings' command so an adversarial-project finding can be recorded exactly as the prompt instructs, with a test covering --source project.

## Steps
- [done] Derive --source choices from FINDING_SOURCES
- [done] List project in findings help + option text
- [done] Test: findingsAdd records project source
- [done] Test: choices stay in sync with FINDING_SOURCES
- [done] Verify build, typecheck and tests pass

## Auto-commit
- Phase 179: Allow project finding source in CLI

## Run report
---
phase: 179
verdict: done
steps:
  - title: "Derive --source choices from FINDING_SOURCES"
    status: done
  - title: "List project in findings help + option text"
    status: done
  - title: "Test: findingsAdd records project source"
    status: done
  - title: "Test: choices stay in sync with FINDING_SOURCES"
    status: done
  - title: "Verify build, typecheck and tests pass"
    status: done
---

# Phase 179 — report from the auto session

## What was done

Fixed blocker 178-1: the adversarial-project prompt instructs reviewers to run
`mini findings add --source project`, but the CLI's `--source` option only
allowed `adversarial | verify`, so commander rejected `project` with exit 1
before the store was ever reached — the whole adversarial-project recording
workflow was unrecordable.

- `src/cli.ts`: the `--source` choices now derive from `FINDING_SOURCES`
  (`['adversarial','verify','project']`) via a static import, instead of a
  hardcoded literal. This eliminates the bug *class* (CLI drifting from the data
  model), not just this instance — adding a new source to the enum now
  automatically flows to the CLI. Updated both the option description and the
  `findings` command help string to list `project`.
- `src/commands/findings.test.ts`: added a round-trip test (`findingsAdd` with
  `source: 'project'` stores and reads back `'project'`) and a guard test that
  `FINDING_SOURCES` contains `'project'`.

## Verification

- `npm run typecheck` — clean.
- `npm run build` — clean.
- Full suite: 87 files, 1207 tests passing.
- **Real CLI check** (the actual bug surface, since the commander layer has no
  importable seam): ran the built `dist/cli.js findings add --source project ...`
  — it now passes commander validation and reaches the handler (fails only on
  "No project in this directory", as expected in a bare temp dir). And
  `--source bogus` is still correctly rejected with
  "Allowed choices are adversarial, verify, project".

## Notes / honest limits

- The `.choices(...)` commander line itself is **not** covered by a unit test —
  `src/cli.ts` self-executes `program.parseAsync()` on import and does not export
  `program`, so there is no clean seam, and the repo has no precedent for
  subprocess-testing the CLI binary. I verified that line manually against the
  built CLI (above) and guarded the underlying data model with the
  `FINDING_SOURCES` test. A full subprocess CLI test would be a larger,
  separate effort and was deliberately not added here.
- Static import of `findingsStore` into `cli.ts` is lightweight: it transitively
  pulls only `store.js`, and both modules import nothing beyond node built-ins,
  so the lean-startup pattern of `cli.ts` is preserved.
- 178-2 (fence-blind `stripFindingsSections`) and 178-3 (CorruptPhaseError
  crashing `mini doctor`) remain open as separate should-know findings — not
  touched in this phase.
