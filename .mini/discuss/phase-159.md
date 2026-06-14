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
