# Phase 127 — Collect ADR in mini:done

**Goal:** Add a 'mini decision --apply' command that writes .mini/decisions/phase-XXX.md from stdin (modeled on 'mini plan --apply'), add writeDecision() to decisionStore with unit tests, and extend the /mini:done prompt (buildDoneSessionPrompt) so Claude drafts a lean ADR (heading + Decision + Why) from what actually happened, lets the user approve/edit it, and writes it BEFORE 'mini done --apply' so it lands in the phase commit — writing nothing when there was no real crossroads. Doctor/undo consistency (item 22) and the status overview marker (item 23) are out of scope.

## Steps
- [done] writeDecision() + heading guard in decisionStore
- [done] mini decision --apply command + CLI wiring
- [done] ADR section in buildDoneSessionPrompt + snapshot
- [done] Docs for the decision command

## Auto-commit
- Phase 127: Collect ADR in mini:done

## Discussion
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

## Run report
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
