---
phase: 187
verdict: done
steps:
  - title: "Add resolvedFindings field to Phase"
    status: done
  - title: "Resolve & record extra findings in finalize"
    status: done
  - title: "Thread option + CLI flag --resolve-finding"
    status: done
  - title: "Undo reopens recorded extra findings"
    status: done
  - title: "Surface open findings at done checkpoint"
    status: done
  - title: "Tests for the full path"
    status: done
verify:
  - title: "Run an end-to-end checkpoint in a real session"
    detail: "I tested the logic with unit tests and the CLI flag via `node dist/cli.js done --help`, but did not drive a live `/mini:do` -> `/mini:done` session where Claude asks the user about a real open finding and then appends `--resolve-finding`. Worth one real pass to confirm the prompt wording reads naturally."
---

# Phase 187 — report from the auto session

## What was built

The `done` checkpoint can now close **extra** open findings beyond the phase's
linked `fromFinding`, and `undo` reverses it symmetrically.

- **Model** (`src/state/types.ts`): new optional `Phase.resolvedFindings?: string[]`
  — the ids this phase closed at its `done` checkpoint beyond `fromFinding`. Old
  `state.json` without the field loads fine (undefined).
- **Finalize** (`src/commands/done.ts`): after closing the linked finding,
  `finalizePhaseSideEffects` walks the requested ids, dedupes (and drops the
  linked id), closes each via the shared `resolveFinding`, and records **only the
  ids it actually flipped open→resolved** onto `phase.resolvedFindings` — before
  the commit, so the rewritten findings file lands in it.
- **Option + CLI** (`src/commands/types.ts`, `src/cli.ts`): `FinalizeOptions.resolveFindings`
  (inherited by `ApplyReportOptions`), threaded through `applyDone` →
  `applyAutoReport` → finalize. New repeatable `mini done --apply --resolve-finding <id>`
  (commander collector), only honored with `--apply`.
- **Undo** (`src/commands/undo.ts`): `findingsToReopen` now returns
  `fromFinding` **plus** `resolvedFindings` for any phase reverting from `done`.
- **Prompt** (`src/prompts/sessionContext.ts`, `src/commands/context.ts`): the
  `done` context lists the open findings (the phase's own linked one filtered out)
  and instructs Claude to append `--resolve-finding <id>` **only after the user
  confirms** this phase also fixed it.

## Design choices / trade-offs

- **Record only what this run closed.** An already-resolved or missing id is a
  tolerant no-op and is deliberately *not* recorded — otherwise `undo` would
  reopen a finding this phase never closed. This is the key invariant for
  reversibility (a project success criterion) and is covered by a test.
- **Closing is opt-in and human-gated.** The prompt is explicit ("only if the
  user confirms") and never assumes. Unrelated findings stay open.

## Adversarial review fixes (187-1, 187-2, 187-3 — fixed in this phase)

An adversarial review raised three findings against the first cut; all were fixed
before closing the phase:

- **187-1** (should-know): the close-list filtered only the linked `fromFinding`.
  Now `buildDoneSessionPrompt` also drops findings raised *against* the current
  phase (origin == this phase) and findings already owned by another phase's
  `fromFinding` (passed in as `linkedFindingIds` from `loadFullState`). Prevents
  offering an unfixed issue or stealing another fix-phase's finding.
- **187-2** (should-know): `--resolve-finding` was silently dropped on every path
  that returns before finalize. Now `applyDone` warns loudly when the phase did
  not finalize, and the CLI warns when `--resolve-finding` is used without
  `--apply`.
- **187-3** (nit): finalize now trims/normalizes ids (so `" 167-7"` and `"167-7"`
  collapse and blanks drop out), plus added tests for duplicate ids in one call,
  undo of a phase with both `fromFinding` and `resolvedFindings`, and the
  non-finalized drop.

## Known limitations (not addressed here, on purpose)

- This reuses the shared `resolveFinding`/`setFindingStatus`, so it **inherits**
  open finding **185-1** (manual resolve can silently drop parser-unreadable
  entries). I did not make it worse, but I did not fix it either — out of scope.

## Verification

- `npx tsc --noEmit` clean.
- `npm test` — 1252 passed (added: 3 finalize tests, 1 undo test, 3 prompt tests).
- `node dist/cli.js done --help` shows the new `--resolve-finding <id>` flag.
