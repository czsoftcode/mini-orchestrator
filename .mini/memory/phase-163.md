# Phase 163 — adversarial-project: context builder

**Goal:** Add a pure buildProjectAdversarialContext builder + prompt that turns a resolved range (resolveRange) into a thin reviewer index: project.md, the resolved range bounds, a phase id+title list (loadPhase, NOT full reports), an explicit 'git diff <from>..<to>' for the reviewer to run, an independent-reviewer role, dedup-first via 'mini findings list', security delegated to /security-review, and findings written via 'mini findings add --source project' — locked by a snapshot test. No interactive session or CLI subcommand wiring (those are 4/7 and 5/7).

## Steps
- [done] Pure prompt builder buildProjectAdversarialSessionPrompt
- [done] Resolve in-range phase list (id+title)
- [done] Context assembler buildProjectAdversarialContext(cwd, input)
- [done] Snapshot + unit tests

## Auto-commit
- Phase 163: adversarial-project: context builder

## Run report
---
phase: 163
verdict: done
steps:
  - title: "Pure prompt builder buildProjectAdversarialSessionPrompt"
    status: done
  - title: "Resolve in-range phase list (id+title)"
    status: done
  - title: "Context assembler buildProjectAdversarialContext(cwd, input)"
    status: done
  - title: "Snapshot + unit tests"
    status: done
---

# Phase 163 — report from the auto session

## What was built
A thin, pure context builder for the upcoming `mini adversarial-project` command —
no CLI dispatch or interactive session wiring (those stay for 4/7 and 5/7).

- **`buildProjectAdversarialSessionPrompt(input)`** in `src/prompts/sessionContext.ts`
  (+ `AdversarialProjectInput` / `AdversarialProjectPhase` types). Pure, no I/O.
  Produces a cross-phase red-team prompt: independent-reviewer role, the resolved
  `git diff <from>..<to>` to run, an id+title-only phase list (NOT full reports),
  a dedup-first instruction (`mini findings list` before recording), security
  explicitly delegated to `/security-review`, findings written via
  `mini findings add --source project`, and the inlined `project.md` block.
- **`resolveRangePhases(cwd, input)`** + **`buildProjectAdversarialContext(cwd, input)`**
  in the new `src/commands/adversarialProjectContext.ts`. The assembler resolves
  the range via `resolveRange`, logs the reason and returns `null` on any range
  error (mirrors `buildAdversarialContext`), then reads `project.md` and the phase
  list and hands them to the prompt builder.

## Design decisions worth noting (no ADR — already specified in the plan)
- **Ref mode returns no phase list.** A plain git ref need not line up with a
  phase boundary, so for `--from/--to` we deliberately return `[]` and the prompt
  falls back to "work from the diff". Mapping refs back to phases heuristically
  would be guesswork; this is honest instead.
- **`project.md` missing degrades gracefully** to a short note rather than
  crashing the whole context (`readProjectSafe`).
- **A gap in the phase range is skipped, not an error** — this is a thin index for
  a human reviewer, not a state mutation.

## Unhappy paths covered (and tested)
- No range given → `null` + logged error.
- Invalid git ref → `null` + logged error.
- `project.md` absent → builds anyway with a placeholder note.
- Missing phase file inside the range → skipped.
- Ref mode → empty phase list, diff-only fallback in the prompt.

## Verification
- `tsc --noEmit` clean.
- Full suite green: 82 files, 1130 tests. New tests: 11 in the prompt-builder
  block + 7 in the assembler/`resolveRangePhases` file.

## Open / next
- This is 3/7. The interactive command (`mini adversarial-project`, 4/7), the
  `mini context adversarial-project` subcommand (5/7), the slash command (6/7) and
  docs (7/7) still consume this builder but are out of scope here.
