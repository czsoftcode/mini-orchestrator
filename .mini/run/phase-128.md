---
phase: 128
verdict: done
steps:
  - title: "buildDecisionSessionPrompt + mini context decision"
    status: done
  - title: "Slim buildDoneSessionPrompt to a thin pointer"
    status: done
  - title: "Thin pointer in the do prompt (buildAutoPhasePrompt)"
    status: done
  - title: "Register /mini:decision in COMMAND_DEFS"
    status: done
  - title: "Docs + README"
    status: done
verify:
  - title: "Are the two thin ADR pointers (do + done) sharp enough?"
    detail: "The acceptance criterion of the phase is behavioural: the pointers must not raise the rate of forgotten ADRs. I can't verify that mechanically — it shows up only on live phases. Read the do pointer (src/prompts/autoPhase.ts, after the acceptEdits line) and the done pointer (src/prompts/sessionContext.ts, '# Decision record (ADR)' in buildDoneSessionPrompt) and judge whether they are sharp/clear enough vs. their brevity."
---

# Phase 128 — report from the auto session

All five steps done, full suite green (917 tests) and `tsc --noEmit` clean. Ran
`mini context decision` live (via tsx) — the new on-demand prompt renders for the
current phase.

## What was done
- **New `buildDecisionSessionPrompt(phase)`** in `sessionContext.ts` holds the
  full ADR drafting instruction (draft → show user → `mini decision --apply`,
  targeting the current phase). Wired as `mini context decision`: `'decision'`
  added to `CONTEXT_COMMANDS`, routed through `buildPhaseContext`.
- **`buildDoneSessionPrompt` slimmed**: the ~37-line ADR block replaced by a
  ~1-line conditional pointer to `/mini:decision`.
- **Thin pointer in `buildAutoPhasePrompt`** (`do`/`auto`): on a real crossroads,
  at the end tell the user to run `/mini:decision` before `/mini:done` — Claude
  does not write the ADR itself.
- **`/mini:decision` registered** in `COMMAND_DEFS` (default thin body → runs
  `mini context decision`).
- **Docs**: new `docs/interactive/decision.md`; `docs/non-interactive/decision.md`
  and `docs/README.md` updated (they used to say the ADR lives "within
  /mini:done"); `/mini:decision` added to the README slash-command list.

## Token reality (the honest number)
The `measure-tokens` snapshot moved as expected:
- **done** template: 976 → **702** tokens (−274 per phase).
- **do**/**auto** template: +~72 tokens (the cost of the fresh-context pointer,
  paid every phase because the pointer sits in the shared prompt).

So the **net** per-phase saving is ~200 tokens, not the ~250 the todo item
guessed — the second pointer eats into it. This matches the trade-off recorded in
the discussion notes; the freshness of detecting a decision during `do` is the
reason the second pointer is there.

## Design decision worth recording
This phase itself hit a real crossroads (full instruction → on-demand command,
pointer in BOTH do and done, "only notify — never auto-write", auto-mode ADRs
deliberately don't fire). Per the new flow, before `/mini:done` consider running
`/mini:decision` to capture the *why* — I'm flagging it rather than writing it,
as designed.

## Watch out for
- The two pointers are a matched pair — if one is later edited, keep the other in
  sync, or they drift on what counts as "a real decision".
- `mini context decision` reuses `buildPhaseContext`, so between `done` and `next`
  (no current phase) it errors with the standard "No current phase" hint. That is
  the intended window (the ADR must be written before `done`).
