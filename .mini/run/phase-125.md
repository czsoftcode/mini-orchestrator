---
phase: 125
verdict: done
steps:
  - title: "Orphaned-doing & stale-report checks (pure)"
    status: done
  - title: "findStaleRunReports helper + gathering"
    status: done
  - title: "Docs"
    status: done
---

# Phase 125 — report

## What was delivered

`mini doctor` gained two phase-hygiene checks.

- **Orphaned `doing` phases.** `DoctorInput.orphanedDoingPhases` (ids) drives a
  `Phases` check that warns when a phase is stuck in "doing" with no open work
  left, hinting at `mini done` (or `mini undo`). Detection reuses the existing
  `isOrphanedDoing` from `status.ts` (covers both the all-steps-closed and the
  all-subphases-closed cases).
- **Stale run reports.** `DoctorInput.staleRunReports` (filenames) drives a
  `Run reports` check that warns about `phase-<id>.md` files in `.mini/run/`
  with no matching phase. The pure helper `findStaleRunReports(files, phases)`
  filters report files (ignoring `.prev.md` backups and non-report files) whose
  id matches no phase, sorted for a stable list.
- Both checks are only emitted when a project exists, and `buildDiagnostics`
  stays pure. `doctor()` now loads the full state (steps live in per-phase
  files, needed by `isOrphanedDoing`) and lists `.mini/run/` to feed them.
- **Docs**: `docs/non-interactive/doctor.md` — both checks in the list and the
  example output.

## Process note (important)

I broke the workflow on this phase: I started implementing during the
`/mini:next` step, before the phase existed in `.mini/`. After you chose "dorovnat
stav workflowem", I reconciled it the proper way — saved the phase (`next --apply
--from-todo 18`, which also ticked off backlog item 18), planned the steps,
marked `doing`, ticked the steps and wrote this report. The code and the state
now line up. Worth keeping the `next` step to proposing only.

## Verification (all mechanical, done here)

- `npm run typecheck` — clean.
- `npm test` — 890 passed (new unit tests for the two checks, the no-project
  case, and `findStaleRunReports`: stale detection, `.prev.md`/non-report
  filtering, all-valid).
- `npm run build` — clean.
- **End-to-end** via the built `dist/cli.js`: a healthy project shows both new
  checks green; a simulated project (a `doing` phase with all steps done + a
  `phase-099.md` with no phase) flags `Phases: phase 1 stuck …` and
  `Run reports: 1 stale (phase-099.md)`, while the valid `phase-001.md` and the
  `phase-001.prev.md` backup are correctly ignored.
