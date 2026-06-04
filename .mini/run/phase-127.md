---
phase: 127
verdict: done
steps:
  - title: "writeDecision() + heading guard in decisionStore"
    status: done
  - title: "mini decision --apply command + CLI wiring"
    status: done
  - title: "ADR section in buildDoneSessionPrompt + snapshot"
    status: done
  - title: "Docs for the decision command"
    status: done
---

# Phase 127 — report from the auto session

The phase wired ADR **writing** on top of phase 126's read-only layer.

## What was done
- **`decisionStore.ts`**: added pure `hasHeading(text)` (true only for a
  top-level `# ` heading) and `writeDecision(cwd, phaseId, body)`. The latter
  trims the body, refuses an empty body (`reason: 'empty'`) and a heading-less
  body (`reason: 'no-heading'`) writing nothing in both cases, otherwise creates
  `.mini/decisions/` and writes/overwrites `phase-XXX.md`. 11 unit tests
  (write, overwrite, empty→nothing, missing heading→nothing, dir creation,
  hasHeading accept/reject incl. sub-headings and `# ` with no text).
- **`src/commands/decision.ts`** (`applyDecision`) + **`mini decision --apply`**
  in `cli.ts` (reads stdin via the shared `readStdin()`). Resolves
  `currentPhaseId` with the same guards as `applyPlanSteps`, plus a `phase-not-
  active` guard (already done/skipped). 6 command tests cover all branches.
- **`buildDoneSessionPrompt`**: new "Decision record (ADR)" section — strict
  threshold (default = write nothing; only a real, rejected-alternative
  crossroads), explicit ADR≠CHANGELOG note, draft-shown-to-user-first, and a
  `printf … | mini decision --apply` snippet to run **before** `mini done
  --apply`. The section appears only when a report exists. 2 new prompt tests.
- **Docs**: new `docs/non-interactive/decision.md`, a mention + Related link in
  `done.md`, and a row in `docs/README.md`.

## Verification (all mechanical, done myself)
- `npx vitest run` — 913 passed (72 files). `npm run build` — clean.
- Updated the `measure.test.ts` token snapshots: the `done` prompt grew
  694→1058 real tokens from the ADR block and moved up the ranking. This was the
  only snapshot change.
- End-to-end smoke test in a throwaway project: success path writes the file,
  overwrite replaces it; empty stdin / heading-less body / missing `--apply` all
  exit 1 and write nothing.

## Notes / watch out
- **Prompt size**: the ADR section added ~360 tokens to the `done` prompt. Once
  per phase, so acceptable, but worth knowing.
- **Threshold is prompt-only**: tests confirm the *text* is present, not that the
  agent actually writes ADRs sparingly. Real behavior shows up only when
  `/mini:done` runs on a live phase — by design.
- **Out of scope** (separate todo items): doctor orphan-check + `mini undo`
  handling of decision files (item 22) and the status-overview marker (item 23).
