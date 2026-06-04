---
phase: 130
verdict: done
steps:
  - title: "findStaleDecisions helper in doctor"
    status: done
  - title: "Gather stale decisions in doctor()"
    status: done
  - title: "Decisions check in buildDiagnostics"
    status: done
  - title: "Tests for the Decisions check"
    status: done
  - title: "Update doctor docs"
    status: done
---

# Phase 130 — report from the auto session

All five steps done; full suite green (929 tests, +5 over the previous phase) and
`tsc --noEmit` clean.

## What was built

- **`findStaleDecisions(decisionDirFiles, phases)`** in `doctor.ts` — a pure
  sibling of `findStaleRunReports`: picks `phase-<id>.md` files (incl. dotted
  subphase ids like `phase-1.5.md`) whose id matches no phase in the state,
  returned sorted. Deliberately **not** merged with `findStaleRunReports` into a
  generic helper — two independent domains, ~3 lines of shared shape; a comment
  records the choice.
- **`listDecisionDir(cwd)`** — private, mirrors `listRunDir`; `[]` when the dir
  is missing.
- **`doctor()`** now lists `.mini/decisions/` in the existing `Promise.all` and
  computes `staleDecisions` only for an existing project.
- **`DoctorInput.staleDecisions: string[]`** + a new **"Decisions"** check in
  `buildDiagnostics`, placed right after "Run reports": `ok` = "no stale
  decisions", `warn` = "N stale (names)" with a delete hint pointing at
  `.mini/decisions/`. Omitted (like the other phase-hygiene checks) when there is
  no project.
- **Docs** — `docs/non-interactive/doctor.md` (check list + example line),
  `docs/interactive/doctor.md` (the description now covers phase hygiene, which it
  previously skipped entirely), and the README command table.

## Verification

Mechanically verified myself on this repo via the local build:

- `node dist/cli.js doctor` (clean) → `✓ Decisions: no stale decisions`.
- After dropping a phantom `.mini/decisions/phase-999.md` →
  `! Decisions: 1 stale (phase-999.md)` + the delete hint. Test file removed
  afterwards.

Nothing for a human to check.

## Notes

- This is **half of backlog item 22** — the `mini doctor` orphan-check. The other
  half (`mini undo` snapshotting/restoring the decision file) was deliberately
  deferred: `undo` today snapshots only `state.json` + `phases/`, not `.mini/run/`
  or `.mini/decisions/`, so handling ADRs there is new mechanics and its own
  phase. Backlog item 22 was therefore **not** ticked off — it stays open for the
  undo follow-up (which may want to re-scope item 22 to just the undo piece).
- No real design crossroads — the not-merging-the-two-helpers call was discussed
  in plan and is a minor style choice, not an ADR-worthy decision.
