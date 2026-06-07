---
phase: 150
verdict: done
steps:
  - title: "Shared projectRefBlock() helper"
    status: done
  - title: "autoPhase 'do' uses the shared helper"
    status: done
  - title: "useProjectRef flag in plan & discuss builders"
    status: done
  - title: "context.ts turns warm paths on"
    status: done
  - title: "Tests for warm/inline plan & discuss"
    status: done
  - title: "Green: npm test + npm run build"
    status: done
---

# Phase 150 — report from the auto session

Part 2 (last item) of the `mini project` series. The warm slash paths
(`plan` / `discuss`, plus the already-referencing `do`) now **reference**
`project.md` instead of inlining it on every invocation; cold paths stay inline.

## What was built
- **`src/prompts/projectRef.ts`** — new `projectRefBlock()` (parameterless, returns
  the body only). General "read .mini/project.md only when you don't have it"
  wording covering compaction / a fresh session after a crash.
- **`src/prompts/autoPhase.ts`** — the `do` `useProjectRef` branch now calls the
  shared helper (its old `do`-specific wording is gone — a deliberate, confirmed
  unification, not a regression).
- **`src/prompts/sessionContext.ts`** — `buildPlanSessionPrompt` got a 4th optional
  param `useProjectRef = false`; on → `projectRefBlock()` instead of `${projectMd}`,
  `# Project` heading kept.
- **`src/prompts/discussPhase.ts`** — `buildDiscussPhasePrompt` got a 3rd optional
  param `useProjectRef = false`, same treatment.
- **`src/commands/context.ts`** — the `plan` and `discuss` branches pass
  `useProjectRef: true` (warm slash path). `next` and the terminal
  `mini plan` / `mini discuss` are untouched (cold, inline).

## Verification (mechanical, done here)
- `npm test` — 953 pass (74 files). New cases: warm vs inline for both
  `buildPlanSessionPrompt` and `buildDiscussPhasePrompt` (warm omits the whole
  project body, includes the read instruction; default still inlines).
- Two snapshots updated, both legitimate side effects of the wording change:
  `autoPhase.test.ts.snap` (the new shared ref text) and
  `tokens/measure.test.ts.snap` (the `do` template grew ~32 tokens — longer
  wording). Confirmed via `git diff` that nothing else changed.
- `npm run build` — clean.
- Smoke test of the built `dist/cli.js`:
  - `mini context plan` (warm) → the `# Project` block is the read-once reference,
    NOT the inlined project.md.
  - `mini context next` (cold) → still inlines the full project.md.

## Notes / open questions
- No real rejected alternative (the design + the warm/cold split were settled in
  discuss) — `/mini:decision` not needed.
- **Accepted risk:** reference mode relies on the model self-assessing whether it
  already has project.md; the wording biases to "when unsure, read", so the worst
  case is a re-read (same cost as today) or, rarely, proceeding without it. This is
  the same risk `do` already carried — not new, just now also on plan/discuss.
- This completes the `mini project` feature per `docs/design/mini-project.md`
  (Parts 1a/1b/1c + 2, phases 147-150).
