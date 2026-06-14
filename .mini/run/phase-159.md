---
phase: 159
verdict: done
steps:
  - title: "resolveFinding/reopenFinding in findings store"
    status: done
  - title: "done resolves linked finding before commit"
    status: done
  - title: "undo reopens linked finding"
    status: done
  - title: "Build and full test suite green"
    status: done
---

# Phase 159 — report from the auto session

## What was done
- **findingsStore.ts**: added a private `setFindingStatus(cwd, id, status)` that
  derives the origin phase from the id, reads only that file, flips one entry's
  status token and re-serializes. On top of it the two exported mutations the goal
  asked for: `resolveFinding(cwd, id)` and `reopenFinding(cwd, id)`. Both return a
  `boolean` (did the file change) and are tolerant by design — a malformed id, a
  missing file, an unknown id or an already-target status are all silent no-ops
  that return `false` and never throw.
- **done.ts**: in the shared `finalizePhaseSideEffects` (the single place all
  three done-closing paths funnel through) it now calls
  `resolveFinding(cwd, phase.fromFinding)` when `fromFinding` is set, **before**
  `commitPhaseWork`, so the rewritten `.mini/findings/...` file is picked up by
  the phase commit's `git add -A`. Not called for skipped phases (already the
  case). Doc comment updated (new step "1b").
- **undo.ts**: after `restorePrev`, a new `findingsToReopen(current, prev)` helper
  collects findings of phases that go `done → non-done` and exist in BOTH states,
  and reopens each. Bound to the state revert, not to the git soft-reset branch.

## Verification (done mechanically, nothing left for a human)
- New unit tests in `findingsStore.test.ts` cover happy paths (open↔resolved keeps
  where/reviewedAt/body and other entries) and every unhappy path (already-target,
  unknown id, missing file, malformed id) — all no-op without throwing.
- `done.test.ts`: a fix phase with `fromFinding` flips its finding to resolved via
  `applyDone`; a phase without `fromFinding` leaves findings untouched; a missing
  linked finding does not break done.
- `undo.test.ts`: undo over `done → planned` reopens; undo where the phase stays
  done in prev does not reopen; undo of a phase absent in prev does not reopen.
- `npm run build` clean; `npm test` → 80 files, 1091 tests passing.

## Notes / open questions
- Out of scope (settled in discuss): a manual `mini resolve` command and any
  re-review semantics (e.g. clearing `reviewedAt`). A status-only flip round-trips
  the rest of the file unchanged, so `reviewedAt`/body survive.
- Known edge left intentionally: `closeOrphanedDoingParents` closes a parent phase
  to `done` *outside* `finalizePhaseSideEffects`, so a `fromFinding` parent closed
  that way would not get its finding resolved. Rare (a fromFinding parent that
  spawned a verify fix sub-phase); flagged rather than handled.
- No real decision crossroads worth an ADR — the two design choices (resolve in
  the shared helper; reopen on state revert) were already settled in discuss.
