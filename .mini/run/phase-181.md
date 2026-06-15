---
phase: 181
verdict: done
steps:
  - title: "Catch CorruptPhaseError around doctor's load"
    status: done
  - title: "Render corruption as a failed check"
    status: done
  - title: "Unit-test the corrupt-phase diagnostic"
    status: done
  - title: "Integration test: doctor survives corruption"
    status: done
  - title: "Verify build, typecheck and tests pass"
    status: done
---

# Phase 181 — report from the auto session

## What was done

Fixes adversarial finding **178-3**: a single corrupt phase file no longer
crashes `mini doctor`.

- **`doctor()` (src/commands/doctor.ts:319)** — the previously bare
  `await load(cwd)` is now wrapped in `try/catch`. A `CorruptPhaseError` is
  caught, its `filePath` captured into `corruptPhaseFile`, and the diagnostic
  continues. Every other error is re-thrown so genuine bugs in `load()` stay
  loud (no blanket swallow).
- **`buildDiagnostics` / `DoctorInput`** — new `corruptPhaseFile: string | null`
  field. When set, a single `fail` "Phases" check is emitted naming the file,
  with a hint to fix/remove it (e.g. resolve git merge-conflict markers). The
  phase-hygiene checks (orphaned/stale run reports/decisions) are suppressed in
  that case, since they need the full state that failed to load. Kept pure (no
  I/O), consistent with the rest of the function.

## Tests

- Unit (`buildDiagnostics`): a corrupt file produces a `fail` check naming the
  path; the stale/orphaned checks are suppressed even when their inputs are
  non-empty.
- Integration (`doctor()`): a real temp project whose `.mini/phases/phase-007.json`
  contains git merge-conflict markers — `doctor()` resolves without throwing and
  its output contains the file name and "unreadable".

## Verification

- `npm run build` — OK
- `npx tsc --noEmit` — clean
- `npx vitest run` — 87 files, 1212 tests passing

## Notes / scope

Scope was kept narrow to `doctor` per the phase plan. The finding also mentions
other read-only commands (e.g. `status`) that load full state and would still
propagate `CorruptPhaseError` to the top-level CLI catch (which prints a clear
message and exits 1 — loud, not an opaque stack trace). That broader hardening
was deliberately left out of this phase; if desired it can become a follow-up.
No design crossroads worth an ADR.
