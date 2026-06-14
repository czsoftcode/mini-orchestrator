# Phase 159 — Resolve linked finding on done

**Goal:** Add a resolveFinding(cwd, id) mutation to the findings store and have mini done --apply flip a completed phase's linked finding (Phase.fromFinding) to resolved, tolerating an already-resolved or missing finding; mini undo reopens it to stay consistent. A manual resolve command and re-review semantics are out of scope (settled in discuss).

## Steps
- [done] resolveFinding/reopenFinding in findings store
- [done] done resolves linked finding before commit
- [done] undo reopens linked finding
- [done] Build and full test suite green

## Auto-commit
- Phase 159: Resolve linked finding on done

## Discussion
# Phase 159 — Resolve linked finding on done

## Intent
Close the loop between an adversarial finding and the fix phase created from it.
Today a finding stays `open` forever even after the fix phase is done. This phase
makes a completed phase flip its linked finding (`Phase.fromFinding`) to
`resolved`, and `mini undo` reopens it so state stays consistent.

Data flow recap: `mini adversarial` writes findings to
`.mini/findings/phase-{originId}.md` as `open`; `mini next --from-finding` creates
a fix phase carrying `fromFinding` (the finding id, `{originId}-{n}`); finishing
that fix phase should now resolve the finding.

## Key decisions
- **Where resolve happens:** in the shared `finalizePhaseSideEffects` (done.ts),
  not only in the `--apply` path. That helper is the single place all three
  done-closing paths funnel through (`applyAutoReport` / `--apply`, interactive
  `finalizePhase`, `collectNotesAndSave`), so resolve fires uniformly however the
  phase is closed. It runs only for `done` (not `skipped`) — already the case.
- **Timing:** call resolve **before** `commitPhaseWork` inside
  `finalizePhaseSideEffects`, so the rewritten `.mini/findings/...` file is picked
  up by the phase commit's `git add -A`.
- **undo reopen condition:** reopen **whenever a phase reverts from `done` to a
  non-done status** (current vs prev compare), bound to the state revert — same
  spirit as restoring `state.json`. Not gated on the git `match`/soft-reset branch.
- **Mutation API (recommended, plan to finalize):** add `resolveFinding(cwd, id)`
  as required by the goal; add a sibling `reopenFinding(cwd, id)` for undo. Both
  can wrap one private `setFindingStatus(cwd, id, status)`. Mirror the existing
  `findFindingById` pattern: derive origin phase from `id`, read only that file,
  flip the one entry's status token, re-serialize. Return whether it changed
  (e.g. `boolean` or the updated `Finding | null`) so callers can log/no-op.
- **Out of scope (settled):** a manual `mini resolve` command and any re-review
  semantics (e.g. clearing `reviewedAt`). Findings serialize round-trips already
  (`serializeFindings` keeps `reviewedAt`), so a status-only flip is safe.

## Watch out for
- **findings file is NOT in `state.json`** — `restorePrev` won't touch it. undo
  must rewrite the finding file explicitly; without it, after a soft reset the
  file stays `resolved` (staged) while the phase reverts to non-done →
  inconsistency. This is the whole reason reopen is in scope.
- **undo target selection:** reopen only for a phase that exists in BOTH current
  and prev and went `done → non-done` and has `fromFinding`. Do NOT reopen for a
  phase missing in prev (e.g. undo of `next` that added a phase) — it never
  resolved a finding.
- **Idempotence / tolerance (unhappy paths):** resolve/reopen must no-op silently
  on: malformed id, missing findings file, finding id not present, status already
  at the target value. Never throw — done/undo must not break because a finding
  vanished or was hand-edited.
- **`closeOrphanedDoingParents` (done.ts):** it closes a parent phase to `done`
  *outside* `finalizePhaseSideEffects`, so a parent closed that way would not get
  its finding resolved. Edge case (a `fromFinding` parent that spawned a verify
  fix sub-phase); acceptable to leave for now, but note it rather than assume it
  can't happen.
- **Tests must cover failure paths**, not just happy path: resolve missing/
  already-resolved/malformed-id; reopen already-open; undo over a non-done revert
  (no reopen); undo reopening a real `done → planned` revert; resolved finding
  landing in the phase commit.

## Run report
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
