---
phase: 158
verdict: done
steps:
  - title: "Add findFindingById lookup helper"
    status: done
  - title: "Add fromFinding field and --from-finding flag"
    status: done
  - title: "Point the next prompt at --from-finding"
    status: done
  - title: "Render the linked finding for discuss and plan"
    status: done
  - title: "Wire context.ts to load the linked finding"
    status: done
  - title: "Document --from-finding"
    status: done
---

# Phase 158 — report from the auto session

All six steps done. `mini next --apply --from-finding <id>` now records a durable
link (`Phase.fromFinding`) to the adversarial finding a phase fixes, and
`discuss`/`plan` read that finding's full detail (title, severity, where, body)
straight from disk via a shared renderer. `do` was left untouched, as agreed.

## What was built
- `findingsStore.findFindingById(cwd, id)` — targeted single-finding lookup
  (derives the origin phase from the id prefix, reads only that file). Returns
  `null` for a malformed id, a missing file, or an absent id; never throws.
- `Phase.fromFinding?: string` + `--from-finding <id>` on `mini next --apply`.
  `applyNewPhase` validates the id **before** saving — an unknown id fails with a
  clear error and writes **no** phase (deliberately stricter than `--from-todo`,
  which only warns). A valid id is recorded without resolving the finding.
- `next` prompt now tells the proposer to pass `--from-finding`, and explicitly
  that it does not close the finding.
- New `src/prompts/linkedFinding.ts` — shared renderer used by both
  `buildDiscussPhasePrompt` and `buildPlanSessionPrompt`. Two shapes: full detail,
  or a soft "could not be found" note.
- `context.ts` loads the linked finding for `discuss`/`plan`; a missing/resolved
  finding degrades to the soft note, never a crash or a misleading "no phase".
- Docs updated: `docs/non-interactive/next.md` (synopsis, options, notes) plus the
  stale "there is no `--from-finding`" claims in `docs/interactive/next.md` and
  `docs/non-interactive/findings.md`.

## Verification (all mechanical, done here)
- `npm run typecheck` — clean.
- `npm test` — 1078 passed. Added failure-path tests: unknown id adds no phase
  (`apply.test.ts`), malformed/missing id returns null (`findingsStore.test.ts`),
  missing linked finding → soft note, not crash (`context.test.ts`).
- Updated 2 token-measurement snapshots: the `next` prompt grew ~46 tokens from
  the always-present `--from-finding` line in the save-command docs (consistent
  with the existing `--from-todo` line). Expected, not a regression.
- `npm run build` — clean.
- End-to-end against the built `dist/cli.js` in a throwaway project: happy path
  saved the phase and `mini context plan` rendered the full finding block
  (`--from-finding 5-1` + detail); unknown id `999-9` printed the error, exited 1
  and added no phase.

## Notes / trade-offs
- The link only exists if the proposer actually passes `--from-finding` in `next`
  — same inherent reliance on the prompt as `--from-todo`. Not a bug; the prompt
  wording is explicit.
- `state.json` is a slim header index (phases-by-files), so `fromFinding` lives in
  the per-phase file, not the index — expected.
- No decision worth an ADR: the `--from-finding` approach and the discuss+plan
  (not `do`) scope were already settled in `/mini:discuss`.
