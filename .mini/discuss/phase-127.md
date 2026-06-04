# Phase 127 — Collect ADR in mini:done

## Intent
Phase 126 only reads decision files. This phase adds **writing** and wires it
into `/mini:done` so a short ADR can be captured when a phase closed — but only
when a real decision was made. "No decision" is represented by the **absence**
of the file (consistent with phase 126's existence-as-truth model), never by an
empty file.

Three pieces:
1. `writeDecision()` in `decisionStore.ts` (+ unit tests).
2. New CLI command `mini decision --apply` (reads the ADR body from stdin,
   modeled on `mini plan --apply`).
3. Extend `buildDoneSessionPrompt` so Claude drafts a lean ADR, **shows it to
   the user for approval/edit**, and writes it **before** `mini done --apply`.

## Key decisions
- **Threshold (kept strict).** Default = write nothing. An ADR is written only
  when a concrete alternative was weighed and rejected, and the choice would not
  be obvious from the code half a year later. Routine choices (naming, `map` vs
  `for`, …) are NOT recorded. The prompt must frame ADR as the exception, not the
  routine, to avoid ADR-spam.
- **Human in the loop, always.** Whenever Claude thinks there is a decision, it
  shows the drafted ADR text to the user and lets them edit/approve before it is
  written. Nothing is written silently.
- **Empty stdin = nothing.** `mini decision --apply` with empty/whitespace stdin
  must NOT write a file — error/no-op, same spirit as `applyPlanSteps` rejecting
  empty steps. Absence of the file = "no decision".
- **Minimal structure check: require a heading.** The command validates that the
  body contains at least a top-level `# ` heading; otherwise it errors and writes
  nothing. Beyond the heading the body stays free markdown (the module's stance:
  structure is a convention for the writer, not a contract for the reader — do
  NOT over-validate Decision/Why sections).
- **Overwrite if exists.** A repeated `/mini:done` (e.g. after a verify-issue
  loop) overwrites the file. No deletion via this command (that is item 22 / undo).
- **Targets `currentPhaseId`.** The ADR is written for the current phase, so the
  command MUST run before `mini done --apply` (afterwards `currentPhaseId` points
  to the next phase). This ordering must be explicit and hard in the prompt.

## Watch out for
- **Ordering for the commit.** The decision file lives outside `state.json`; the
  `done` phase commit picks it up via `git add -A` only if it exists **before**
  `mini done --apply`. Wrong order → ADR committed late (next phase) or under the
  wrong phase id.
- **ADR ≠ CHANGELOG.** The prompt already drives CHANGELOG (what changed for
  users). The ADR is *why* a technical path was chosen. Keep them distinct in the
  prompt so Claude does not duplicate the same text into both.
- **Snapshot tests.** `buildDoneSessionPrompt` has snapshot tests — adding the
  ADR section will require updating the snapshot.
- **Scope.** Doctor orphan-check + `mini undo` handling (item 22) and the status
  overview marker (item 23) are explicitly out of scope here.
