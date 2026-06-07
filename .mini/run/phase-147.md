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
