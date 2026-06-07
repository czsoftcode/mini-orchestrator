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
