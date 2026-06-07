---
phase: 148
verdict: done
steps:
  - title: "parseProjectContract block parser"
    status: done
  - title: "applyProject writes only project.md"
    status: done
  - title: "Tests: parseProjectContract"
    status: done
  - title: "Tests: applyProject"
    status: done
  - title: "Green: npm test + npm run build"
    status: done
---

# Phase 148 — report from the auto session

Part 1b of the `mini project` design. New file `src/commands/project.ts` with two
exports; new `src/commands/project.test.ts`. No other files touched (scope guard
held: no CLI/context/session/COMMAND_DEFS/docs — those are phases 35/36).

## What was built
- **`parseProjectContract(text)`** — a genuine block parser (import-gsd's
  single-line regex was not reusable). A known label starts a field only at
  column 0 via `^(NAME|WHAT|FOR_WHOM|CONSTRAINTS|APPROACH|NON_GOALS|SUCCESS):`;
  the value runs across following lines to the next label or EOF, trimmed, with
  internal newlines preserved. Lone `-` → empty. Returns `null` when NAME or WHAT
  is missing (the hard required-field check the user asked for).
- **`applyProject(parsed, cwd?)`** — requires an existing project
  (`{ ok:false, reason:'no-project' }` + "Run mini init first" otherwise),
  resolves `forWhom`/`constraints` placeholders (renderer stays pure layout),
  renders via the shared `src/state/projectMd.ts` and `writeProject`. Never
  touches `state.json`. Returns `StepOutcome`.

## Verification (all mechanical, done here)
- `npm test` — 946 tests pass (74 files), incl. `init.test.ts` /
  `import-gsd.test.ts` unchanged (proof the shared renderer output is intact).
- New `project.test.ts` — 12 tests: multi-line bullet sections, empty optionals,
  label-like text not at column 0 stays content, missing NAME/WHAT → null, lone
  `-` → empty, text-before-first-label ignored; applyProject renders the new
  sections + keeps `## What I'm building`, resolves placeholders, errors without a
  project, and leaves `state.json` byte-identical.
- `npm run build` — clean (one `string | undefined` from `m[2]` under the build
  tsconfig fixed with `m[2] ?? ''`).

## Notes / open questions
- No real rejected alternative arose during implementation — the merge-vs-replace
  decision was already settled in the discussion (`/mini:decision` not needed).
- Documented, deliberately-unhandled edge case (in the JSDoc): a content line that
  itself begins at column 0 with a known label + `:` is read as a new section.
  Rare in the machine-generated contract; indented/bulleted label-likes are safe.
- Forward note: phase 35 wires CLI `project --apply` (stdin → parseProjectContract
  → on `null` a readable error → applyProject) and the session prompt that must
  re-send the existing NAME/FOR_WHOM/CONSTRAINTS (the "full replace" contract
  relies on it).
