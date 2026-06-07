# Phase 148 — mini project --apply contract

**Goal:** In src/commands/project.ts add applyProject (requires an existing project, else error 'run mini init first'; renders via the shared src/state/projectMd.ts and writes only project.md, never state.json) and a block parser parseProjectContract (labels NAME/WHAT/FOR_WHOM/CONSTRAINTS/APPROACH/NON_GOALS/SUCCESS, modeled on the import-gsd parser; each value runs up to the next known label or EOF). Cover with src/commands/project.test.ts: multi-line bullet sections, empty optional fields, a label-like string inside text. Scope is parser + apply + tests only — no CLI/context/session wiring (those are todo 35/36).

## Steps
- [done] parseProjectContract block parser
- [done] applyProject writes only project.md
- [done] Tests: parseProjectContract
- [done] Tests: applyProject
- [done] Green: npm test + npm run build

## Auto-commit
- Phase 148: mini project --apply contract

## Discussion
# Phase 148 — mini project --apply contract

## Intent
Part 1b of the `mini project` design (`docs/design/mini-project.md`). Build the
non-interactive write path that later phases (35/36: CLI + slash + session) will
call. Scope is strictly: a block parser + an apply function + tests. NO CLI,
context, session or COMMAND_DEFS wiring in this phase.

New file `src/commands/project.ts` with:
- `parseProjectContract(stdin)` — block parser for the contract labels
  `NAME / WHAT / FOR_WHOM / CONSTRAINTS / APPROACH / NON_GOALS / SUCCESS`.
- `applyProject(parsed, cwd?)` — requires an existing project, renders via the
  shared `src/state/projectMd.ts` (from phase 147) and writes ONLY `project.md`
  (never `state.json`).

Plus `src/commands/project.test.ts`.

## Key decisions
- **Full replace from the contract, NOT merge in code.** The contract carries all
  fields; `applyProject` renders exactly what it gets. Rejected the merge option
  (read existing `project.md`, overwrite only present fields) because it needs a
  second project.md→fields parser — a third reader of the heading layout (next to
  `status.ts` regexes and the renderer) and a render↔parse round-trip that can
  silently corrupt data. The "keep existing NAME/FOR_WHOM/CONSTRAINTS" duty
  belongs to the session prompt in phase 35 (the agent reads project.md there and
  re-sends the old values). User confirmed.
- **Hard check of required fields instead of silent fallback.** `parseProjectContract`
  returns `null` when NAME or WHAT is missing (like `import-gsd`'s `parseResponse`).
  The CLI (phase 35) turns `null` into a readable error. This makes a dropped
  required field a loud failure, not silent data loss — the safety the user wanted
  without the merge parser.
- **Required = NAME + WHAT.** FOR_WHOM/CONSTRAINTS optional with fallbacks;
  APPROACH/NON_GOALS/SUCCESS optional (section omitted when empty). User confirmed.
- **Block parser rule:** a known label starts a new field ONLY when the line
  begins at column 0 with the exact uppercase label followed by `:`
  (`^(NAME|WHAT|FOR_WHOM|CONSTRAINTS|APPROACH|NON_GOALS|SUCCESS):`). Bullets
  (`- …`), indented lines and mid-line label-like text stay as content. A value
  runs from after its label to the next label line or EOF; `trim()` at the end,
  internal newlines preserved (multi-line bullet sections must survive).
- **Fallbacks live in `applyProject`, not the renderer.** Renderer stays pure
  layout (phase 147). `applyProject` resolves `forWhom || '(not specified)'`,
  `constraints || '(none)'` before rendering; passes optional fields through only
  when non-empty.
- **Return type `StepOutcome` (`{ ok, reason }`)** mirroring `applyImport`.
  Reasons: project missing (`no-project`, error "run mini init first").
- **`applyProject` signature takes the already-parsed object** (`applyProject(parsed, cwd?)`),
  parsing happens separately in `parseProjectContract` — so the CLI in phase 35
  parses stdin then calls apply. Tests in this phase call both directly.

## Watch out for
- **Do NOT touch `status.ts` or the renderer headings.** `status.ts` parses
  `project.md` by regex on `# <name>` / `## What I'm building`. The renderer
  (phase 147) already preserves them; this phase only feeds it.
- **The block parser is the main risk** — cover with tests: multi-line bullet
  sections (Approach/Non-goals/Success), empty optional fields (omitted from
  output), a label-like string NOT at column 0 (kept as content), missing
  NAME/WHAT → `null`. Documented edge case (accepted, not handled): a content
  line that literally starts at column 0 with a known label + `:` is treated as a
  new section — rare in a machine-generated contract.
- **Treat a lone `-` value as empty** (consistent with `import-gsd`'s `normalize`),
  but only when the entire trimmed value is exactly `-` (a bullet `- item` is not).
- `import-gsd`'s `parseResponse` is single-line regex and CANNOT be reused here —
  the new parser is genuinely multi-line/block. Model the apply/return shape on
  `applyImport`, not the parser.
- Scope guard: no CLI command, no `context.ts` branch, no `sessionContext.ts`
  prompt, no `COMMAND_DEFS` entry, no docs — those are phases 35/36.

## Run report
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
