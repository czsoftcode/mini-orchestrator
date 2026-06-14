# Phase 158 — Link phase to finding

**Goal:** Add a --from-finding <id> flag to mini next --apply that durably records on the phase which open adversarial finding it addresses (single id; the finding stays open, unlike --from-todo which ticks its source). The next prompt instructs the proposer to pass it when a phase is born from an open finding. discuss and plan then read the linked finding's full entry from .mini/findings/ and inject its detail (title, body, where, severity) into their prompts; a missing/resolved finding degrades to a soft note instead of failing. do is unchanged.

## Steps
- [done] Add findFindingById lookup helper
- [done] Add fromFinding field and --from-finding flag
- [done] Point the next prompt at --from-finding
- [done] Render the linked finding for discuss and plan
- [done] Wire context.ts to load the linked finding
- [done] Document --from-finding

## Auto-commit
- Phase 158: Link phase to finding

## Discussion
# Phase 158 — Link phase to finding

## Intent
Give `discuss` and `plan` a **durable** way to know which open adversarial
finding the current phase is meant to fix, so they can read that finding's full
detail from disk — even in a fresh session days later, not relying on the chat
context left behind by `next`.

This reshapes the original idea ("inject an open-findings block into plan and
do"). The problem found during discussion: there is no link between a phase and
the finding it addresses (no `--from-finding`), and a finding is bound to its
**origin** phase (where the review found it), not to the fix phase. Filtering
"findings of the current phase" would therefore show nothing for a freshly
created fix phase. And relying on "findings are already in the session context
from `next`" breaks mini's core promise (resume after days in a new session).

Solution: a stored link plus on-demand full read of the linked finding.

## Key decisions
- **New flag `--from-finding <id>` on `mini next --apply`.** Records on the
  phase which finding it addresses (e.g. a field like `fromFinding: "155-1"` in
  the phase file). Mirror the existing `--from-todo` plumbing for parsing/store.
- **Different semantics from `--from-todo`.** `--from-todo` ticks its source
  item immediately. `--from-finding` must **NOT** resolve/close the finding —
  the finding stays `open` until the fix is actually done and verified
  (`done`/`verify`). It only records the link.
- **Single id per phase.** One phase = one fix. No multi-finding support yet
  (YAGNI); extend later if needed.
- **`next` prompt instructs the proposer** to pass `--from-finding <id>` when a
  phase is born from an open finding (parallel to the existing `--from-todo`
  guidance in the next prompt's findings block).
- **`discuss` and `plan` consume the link.** In `context.ts`, when the current
  phase has `fromFinding`, load that finding's full entry from
  `.mini/findings/phase-{originId}.md` and inject its detail (title, body,
  where, severity) into the prompt. The body is the actionable "what breaks and
  how" detail that the `next` headline list does not carry.
- **`do` is unchanged.** It executes the plan (which already encodes the fix)
  and usually runs in the same session as `plan`.

## Watch out for
- **Proposer may forget the flag.** If `next` doesn't pass `--from-finding`, the
  link is missing and discuss/plan have nothing to read. This relies on the
  model following the prompt instruction (same inherent weakness as
  `--from-todo`); it is not a bug to "fix", but the next prompt wording must be
  clear.
- **Invalid / stale id.** `--from-finding` on a non-existent finding id must
  fail with a clear error at save time. Conversely, when discuss/plan read a
  linked finding that has since been resolved or whose file was removed, they
  must degrade to a soft note ("finding not found / already resolved"), never
  crash or print a misleading "no phase" message.
- **Finding id format** is `{originPhaseId}-{n}` (e.g. `155-1`); the origin
  phase id is the prefix, which is how the file `.mini/findings/phase-155.md`
  is located. Parse defensively.
- **Token cost.** Inlining the full finding body grows the discuss/plan prompt,
  but only when a link exists; no link → no block. Keep the rendered block lean
  (one finding, its fields, its body).
- **Reuse, don't duplicate.** `listFindings` / the findings store already parse
  entries and tolerate a missing dir; reuse that path rather than re-reading
  files ad hoc. The `next` findings block in `sessionContext.ts` is the
  rendering precedent to follow.

## Run report
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
