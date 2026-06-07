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
