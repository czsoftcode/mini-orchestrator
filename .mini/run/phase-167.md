---
phase: 167
verdict: done
steps:
  - title: "Add emptyTreeSha helper to git.ts"
    status: done
  - title: "Genesis fallback in resolvePhaseRange"
    status: done
  - title: "Update doc comments for the new start semantics"
    status: done
  - title: "Tests: genesis fallback + still-erroring middle phase"
    status: done
---

# Phase 167 — report

## What was done
- **`emptyTreeSha(cwd)`** added to `src/git.ts`. It reads the repo's object
  format via `git rev-parse --show-object-format` and returns the matching
  well-known empty-tree id (`4b825dc…` for sha1, `6ef19b4…` for sha256), or
  `null` when git can't be queried / the format is unknown. This keeps it correct
  for SHA-256 repos rather than blindly assuming SHA-1.
- **`firstPhaseId(cwd)`** added to `src/state/store.ts`. It derives the lowest
  phase id from the `phase-<id>.json` file names in `.mini/phases/`, independent
  of the `state.json` header — so callers that only wrote phase files (and the
  range tests, which don't write a header) get a correct answer. Returns `null`
  when there are no phase files.
- **`resolvePhaseRange` (src/range.ts)**: when the start phase has no recorded
  `autoCommit.preSha`, it now checks whether `fromPhase` is the project's first
  phase (`fromPhase === firstPhaseId`). If so, `fromSha` falls back to the empty
  tree (diff from project genesis); the `emptyTreeSha === null` case returns a
  clear error rather than crashing. Any **non-first** phase without `preSha` keeps
  the previous hard error.
- **Doc comments** on `resolveRange` updated: the phase-mode paragraph describes
  the genesis fallback, and the "hard-fails" list now says a *non-first* phase
  without `preSha` fails (a first phase doesn't).
- **Tests** (`src/range.test.ts`):
  - New: first phase with no `preSha` → `fromSha === emptyTreeSha(cwd)`,
    `toSha === preSha(2)`, `ok: true`.
  - Adjusted the existing "no preSha → error" test so the start phase (5) is no
    longer the project's first (added a lower phase 4); it still errors as before.
    Without this change the new fallback would have turned that case green.

## Verification
- `npm run typecheck` — clean.
- Full `vitest run` — 83 files, **1141 tests pass** (was 1140; +1 new test).
- The genesis test asserts against `emptyTreeSha(cwd)` (which independently
  queries git), so it stays correct regardless of the repo's hash algorithm.

## Notes / trade-offs
- **Scope:** this fixes only the **range start**. The range **end** still uses
  `preSha(to+1)`/HEAD and remains broken for early phases (1–13) whose commits
  are squashed into the init commit and have no recorded `preSha`. Reviewing a
  range that *ends* inside 1–13 is still inherently lossy — out of scope here,
  flagged earlier with the user.
- **Empty-tree id:** still two fixed constants (per hash algorithm), not a value
  computed via `git hash-object`/`mktree`. A true computation would need stdin
  piping, which `runGit`/async `execFile` don't support; the object-format lookup
  covers the real risk (sha256) at far lower cost. Agreed with the user up front.
- **`emptyTreeSha === null` branch** (git unavailable / unknown format) is guarded
  but not unit-tested — it would require mocking a git failure. Low risk: it
  returns a clear error, not a crash.

## For the human
Nothing UI-only to eyeball — pure range-resolution logic, all verified
mechanically. If you want a live check: in a repo whose first phase lacks a
preSha, `mini context adversarial-project --from-phase 1 --to-phase <M>` should
now print a prompt with a `git diff <empty-tree>..<sha>` instead of erroring.
