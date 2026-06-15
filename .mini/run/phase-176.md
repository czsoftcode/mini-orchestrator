---
phase: 176
verdict: done
steps:
  - title: "Add CorruptPhaseError type"
    status: done
  - title: "readPhaseFile distinguishes ENOENT from corrupt"
    status: done
  - title: "Propagate through loaders, no silent fallback"
    status: done
  - title: "Tests: corrupt vs missing"
    status: done
  - title: "Verify build, typecheck and tests pass"
    status: done
---

# Phase 176 — report from the auto session

## What was done

Fixed adversarial finding **167-1** (blocker) / backlog item 3: the phase-detail
loader no longer treats a corrupt file the same as a missing one.

- **New `CorruptPhaseError`** in `src/state/store.ts` (exported), carrying the
  offending `filePath` and the original `cause`. Message: `Corrupt phase file
  <path>: <reason>`.
- **`readPhaseFile` rewritten**: a read failure with `code === 'ENOENT'` still
  returns `null` (benign "missing"); any other read error *or* a `JSON.parse`
  failure now throws `CorruptPhaseError`. The old blanket `catch { return null }`
  is gone.
- The error propagates naturally through `loadPhase`, `assembleState`,
  `loadFullState` and `loadPrev`. The `detail ?? {id,title,status}` fallback in
  `assembleState` now only applies to a genuinely missing (`null`) phase — a
  throw skips it, so a corrupt detail can no longer silently degrade to the bare
  header and then be overwritten by the next save.

## Caller audit (step 3)

Checked every `loadPhase` caller: `verifyContext`, `adversarialContext`,
`context`, `adversarialProjectContext`, `securityTarget`, `range`. They all only
test for `null`/`!phase` and do **not** wrap `loadPhase` in a try/catch, so:

- the misleading "No phase … run /mini:next" message now fires **only** for a
  truly missing phase;
- a `CorruptPhaseError` bubbles to the top-level handler in `cli.ts:688`
  (`console.error(err)` + exit 1), which prints the clear message — i.e. the real
  problem instead of "no phase".

(The one nearby `catch` in `adversarialProjectContext.ts:39` wraps `readProject`,
not `loadPhase` — left as-is.)

## Tests

Added a `corrupt vs. missing phase file` describe block in
`src/state/store.test.ts`:
- corrupt JSON (git conflict markers) → `loadPhase` and `loadFullState` throw
  `CorruptPhaseError`, and the thrown error contains the file path;
- missing file → still `null`;
- 167-1 regression: a load → mutate → save flow aborts at the load (throws
  before save), and the corrupt file on disk is left byte-for-byte untouched.

## Verification

`npm run build`, `npx tsc --noEmit` and the full suite (`npx vitest run`,
1189 tests) all green.

## Trade-off / what to watch

This is a deliberate behaviour change: code paths that previously got a silent
`null` for an unreadable file now get an exception. That is the point (fail loud,
don't lose data), but it means a single corrupt phase file in a range now aborts
whole-range operations (e.g. adversarial-project, `loadFullState`) rather than
quietly skipping that phase. That is the intended trade-off for the blocker — the
fix is for the human to repair/remove the corrupt file, which the clear error now
points at directly. No decision worth an ADR.
