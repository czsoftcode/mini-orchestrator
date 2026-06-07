# Phase 147 — Shared project.md renderer

**Goal:** Extract renderProjectMd into a new src/state/projectMd.ts with optional Approach/Non-goals/Success fields, and have init.ts and import-gsd.ts import it so that with the optional fields omitted the output is byte-identical (existing init.test.ts and import-gsd.test.ts pass unchanged).

## Steps
- [done] Create src/state/projectMd.ts renderer
- [done] Unit test src/state/projectMd.test.ts
- [done] Rewrite init.ts to use shared renderer
- [done] Rewrite import-gsd.ts to use shared renderer
- [done] Verify byte-identity: tests + build

## Auto-commit
- Phase 147: Shared project.md renderer

## Discussion
# Phase 147 — Shared project.md renderer

## Intent
Merge the two near-duplicate project.md generators into one shared module and
add (yet-unused) optional sections, as groundwork for the later `mini project`
command (todo 34/35).

- Today: `init.ts:155 renderProjectMd(d)` and `import-gsd.ts:149
  buildImportProjectMd(parsed)` produce project.md almost identically.
- This phase: extract into `src/state/projectMd.ts` exporting
  `renderProjectMd({ name, what, forWhom, constraints, approach?, nonGoals?,
  success? })`; init.ts and import-gsd.ts import it and delete their local
  functions.
- The optional Approach/Non-goals/Success sections are added to the renderer but
  no caller passes them yet (prep only).
- Acceptance: with optional fields omitted the output is **byte-identical** to
  today — existing init.test.ts and import-gsd.test.ts pass UNCHANGED.

## Key decisions
- **Pure renderer, no internal fallbacks.** The renderer only lays out sections;
  it never substitutes defaults for empty values. Each caller resolves its own
  fallbacks BEFORE calling, preserving current behaviour exactly:
  - init: `forWhom` passed as-is (may be empty), `constraints || '(none)'`.
  - import-gsd: `forWhom || '(not specified)'`, `constraints || '(none)'`.
  Reason: the two callers diverge ONLY on the forWhom fallback (init → empty,
  import-gsd → `(not specified)`, asserted at import-gsd.test.ts:66). A single
  internal fallback would break one snapshot. One rule ("renderer never fills
  defaults") = zero behaviour-change risk; cost is a duplicated `|| '(none)'`.
- **Section order:** `# name` → `## What I'm building` → `## Who it's for` →
  `[## Approach]` → `[## Non-goals]` → `[## Success criteria]` →
  `## Main constraints`. Main constraints stays LAST even with optional sections
  present. Optional sections render only when their value is non-empty.
- **New `src/commands/projectMd.test.ts`** (or `src/state/projectMd.test.ts`)
  covering the optional-section rendering, since no caller exercises that path in
  this phase — otherwise the new branches ship untested.

## Watch out for
- **Do not touch the headings.** `status.ts:85,357` parse project.md by regex and
  depend on `# <name>` and `## What I'm building`. Renderer must keep them;
  status.ts is NOT changed in this phase.
- **Byte-identity is the proof.** Run init.test.ts (asserts `(none)` at :88) and
  import-gsd.test.ts (asserts `(not specified)` + `(none)` at :66-67) FIRST and
  unchanged; they are the acceptance criterion.
- Preserve the single trailing `\n` after the last section (both current
  templates have it).
- **Scope guard:** this phase = extract + optional rendering + its unit test
  only. It does NOT wire optional fields into init/import-gsd, does NOT add the
  `mini project` command, does NOT change status.ts (those are todo 34/35).
- Forward note (later phases, not 147): the user expects `mini project` to run
  after `init` OR standalone mid-phase, enriching an EXISTING project.md (it does
  not create one). Keep the renderer caller-agnostic so a third caller
  (`project --apply`) can pass the optional fields with no layout change.

## Run report
---
phase: 147
verdict: done
steps:
  - title: "Create src/state/projectMd.ts renderer"
    status: done
  - title: "Unit test src/state/projectMd.test.ts"
    status: done
  - title: "Rewrite init.ts to use shared renderer"
    status: done
  - title: "Rewrite import-gsd.ts to use shared renderer"
    status: done
  - title: "Verify byte-identity: tests + build"
    status: done
---

# Phase 147 — report from the auto session

## What was done
- New `src/state/projectMd.ts` with `renderProjectMd(ProjectMdFields)` — a **pure
  layout** function (no internal fallbacks). Section order: name → What I'm
  building → Who it's for → [Approach] → [Non-goals] → [Success criteria] → Main
  constraints. Optional sections render only when non-empty; Main constraints
  always last; single trailing newline.
- `src/state/projectMd.test.ts` — 5 tests: required-only exact-string output,
  empty values passed through verbatim (no `(none)`/`(not specified)` injected),
  optional sections in order, empty/omitted optionals dropped, Main constraints
  stays last.
- `init.ts` — deleted the local `renderProjectMd`; now imports the shared one and
  resolves its own fallback at the call site (`constraints || '(none)'`,
  `forWhom` as-is) at both call sites (`applyInit` + interactive `init`).
- `import-gsd.ts` — deleted `buildImportProjectMd` (single caller); `saveImport`
  now calls the shared renderer with `forWhom || '(not specified)'` and
  `constraints || '(none)'`.

## Verification (all mechanical, done myself)
- `npm test` — **934 passed (73 files)**. Crucially `init.test.ts` (6) and
  `import-gsd.test.ts` (5) pass UNCHANGED → byte-identity of the output holds.
- `npm run build` — clean (tsc + asset copy).
- `status.ts` not touched (`git diff` confirms 0 hits); the `# <name>` and
  `## What I'm building` headings are preserved by the renderer.

## Notes / decisions
- The discussion's open question (where fallbacks live) was resolved as **pure
  renderer, fallbacks at the call site**. No real alternative was weighed and
  rejected at implementation time beyond what the discussion already covered, so
  there is likely nothing new for `/mini:decision` — the rationale is already in
  `.mini/discuss/phase-147.md`.
- Dependencies were not installed in the working tree; I ran `npm install` to be
  able to run tests/build. That synced a stale `package-lock.json`
  (name/version `mini`@0.2.11 → `mini-orchestrator`@1.17.1) as a side effect — I
  **reverted** the lockfile so this phase's diff stays limited to the renderer
  change. The stale lock is a pre-existing, unrelated issue worth fixing in its
  own change.

## Scope kept (not done here, by design — todo 34/35)
- No optional fields are wired into init/import-gsd yet, no `mini project`
  command, no `status.ts` change. The optional rendering path exists only in the
  renderer and is covered by `projectMd.test.ts`.
