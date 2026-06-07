# Phase 150 — project.md reference mode

**Goal:** Extract a shared projectRefBlock() helper in src/prompts/ ('read .mini/project.md only when you don't already have it in context, e.g. after compaction or a crash') and switch the warm slash paths to reference project.md instead of inlining it: add an optional useProjectRef flag to buildPlanSessionPrompt and buildDiscussPhasePrompt (default inline so existing snapshots stay), set it true in context.ts's plan and discuss branches, and rewrite autoPhase.ts's existing inline useProjectRef block for 'do' to reuse the same helper. Cold paths stay inline: next (cold opener), and the interactive terminal mini plan / mini discuss (no flag passed). Covered by snapshot tests (autoPhase.test.ts updated + plan and discuss warm cases: the warm prompt omits the whole project.md but includes the instruction to read it). Last item of the mini project series (Part 2).

## Steps
- [done] Shared projectRefBlock() helper
- [done] autoPhase 'do' uses the shared helper
- [done] useProjectRef flag in plan & discuss builders
- [done] context.ts turns warm paths on
- [done] Tests for warm/inline plan & discuss
- [done] Green: npm test + npm run build

## Auto-commit
- Phase 150: project.md reference mode

## Discussion
# Phase 150 — project.md reference mode

## Intent
Part 2 (last item) of the `mini project` series. Today `plan` and `discuss` inline
the whole `project.md` (`# Project\n${projectMd}`) on every slash invocation —
wasteful now that `project.md` is richer. Switch the **warm slash paths** to a
**reference** instead of an inline: a shared `projectRefBlock()` helper that says
"read `.mini/project.md` only when you don't already have it in context". Cold
paths stay inline. `do` already references project.md (autoPhase `useProjectRef`)
— this unifies the wording into the shared helper.

## Key decisions
- **Shared helper `projectRefBlock()` in a new `src/prompts/projectRef.ts`** (small
  shared-snippet module, like `graphHint.ts` / `parallelismHint.ts`). Parameterless;
  returns the inner reference text (the caller renders the `# Project` heading).
- **General wording (also updates `do`).** Replace autoPhase's `do`-specific text
  ("typically during /mini:plan or at the start of auto") with the design doc's
  general wording, confirmed by the user as an improvement (not a regression):
  > The project is in `.mini/project.md`. If you already **have it in context**
  > from earlier in this session, **do not read it again**. If you are unsure — a
  > long session where it may have scrolled out of context (compaction), or a new
  > session after a crash — read `.mini/project.md` (whole, once) via the Read
  > tool. **Read it only when you don't have it.**
  (Adapt to the existing English voice; keep the "read only when you don't have
  it" core.)
- **`useProjectRef` as an optional trailing param, default off (inline)** so the
  existing snapshots stay green:
  - `buildDiscussPhasePrompt(projectMd, phase, useProjectRef?)` — 3rd param.
  - `buildPlanSessionPrompt(projectMd, phase, discussNotes?, useProjectRef?)` — 4th param.
  - `autoPhase` keeps its `useProjectRef` field but its ref branch now calls the
    shared helper.
- **Warm = the slash paths via `context.ts`:** set `useProjectRef: true` in the
  `plan` and `discuss` branches (`do` already passes it). `discuss` counts as warm:
  in the normal flow it runs after `next` in the same session (which inlined the
  project cold), so the agent already has it; the `/clear`-then-`/mini:discuss`
  cold case is bounded — the agent just reads the file once (one extra Read).
- **Cold = inline, unchanged:** `next` (cold opener, `buildNextSessionPrompt`
  untouched) and the interactive terminal `mini plan` / `mini discuss` (pass no
  flag → default inline). The headless `mini do` builder (`doPhase.ts`, separate
  from autoPhase) is NOT in scope and stays inline.

## Watch out for
- **`buildNextSessionPrompt` stays inline — do not add the flag there.** Only
  `plan`, `discuss`, `do` reference.
- **Don't change the terminal `plan.ts` / `discuss.ts` calls** — they must keep
  inlining (cold). Only `context.ts` (the slash path) turns the flag on.
- **Tests to update / add:**
  - `autoPhase.test.ts` — the `useProjectRef` assertion now expects the new shared
    wording (old "typically during /mini:plan" string is gone).
  - `sessionContext.test.ts` — a warm `buildPlanSessionPrompt(..., true)` case: the
    prompt does NOT contain the whole project.md but DOES contain the instruction
    to read `.mini/project.md`; and the default (no flag) still inlines.
  - `discussPhase.test.ts` — the same two cases for `buildDiscussPhasePrompt`.
  - A test can only assert the prompt text (omits project / includes the read
    instruction), NOT the agent's actual read behavior — that's inherent to
    reference mode and accepted (the same risk `do` already carries).
- **Risk (acknowledged):** reference mode relies on the model self-assessing
  whether it has project.md; the wording biases to "when unsure, read", so the
  worst case is a re-read (same cost as today) or, rarely, proceeding without it.
- Keep the `# Project` heading in each builder; the helper returns only the body.

## Run report
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
