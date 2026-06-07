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
