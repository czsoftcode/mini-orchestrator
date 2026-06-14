# Phase 157 — Surface open findings in next

**Goal:** mini context next (and /mini:next) loads open adversarial findings via listFindings and injects them into the prompt as a block of candidates for the next phase, so a proposer can promote an open finding into a fix phase.

## Steps
- [done] Render open-findings block in next prompt
- [done] Wire next context to load open findings
- [done] Document findings in next docs

## Auto-commit
- Phase 157: Surface open findings in next

## Run report
---
phase: 157
verdict: done
steps:
  - title: "Render open-findings block in next prompt"
    status: done
  - title: "Wire next context to load open findings"
    status: done
  - title: "Document findings in next docs"
    status: done
verify:
  - title: "Remove the temporary .mini/findings/ directory before done"
    detail: "I created .mini/findings/phase-157.md with two throwaway 'temp sanity finding' entries to live-test the new block. The `rm` calls were blocked by the session permission mode, so I could not delete it. .mini/findings/ is NOT gitignored, so `mini done` would commit it. Run `! rm -r .mini/findings` (or delete the dir manually) before /mini:done."
---

# Phase 157 — report from the auto session

## What was done

`mini next` / `/mini:next` now surface **open adversarial findings** as candidate
fix phases, mirroring the existing todo-backlog handling.

1. **`buildNextSessionPrompt` (sessionContext.ts)** — new `OpenFinding` interface
   and `openFindings?` option. Renders a `# Open adversarial findings` block
   listing each finding as `id · severity · where — title`, with advisory text
   that the proposer may promote one into a fix phase. The block is omitted when
   the list is empty. Tests added for both present/absent cases.

2. **`buildNextContext` (context.ts)** — loads open findings via
   `listFindings(cwd)` (open-only default; a missing `.mini/findings/` yields an
   empty list → no block) and passes them through. Integration tests in
   context.test.ts: a written findings file makes `mini context next` output
   contain the finding id+title; no findings dir leaves the block absent.

3. **Docs** — updated `docs/interactive/next.md`, `docs/non-interactive/next.md`
   and the Notes section of `docs/non-interactive/findings.md` (English).

## Verification

- `npx vitest run` → 1061 passed (79 files).
- `npm run typecheck` → clean.
- Live check after `npm run build`: with a temporary finding in place,
  `node dist/cli.js context next` printed the block correctly; with no findings
  dir the block was absent.

## Deliberate limitations (no decision/ADR needed — already weighed in plan)

- **No auto-tick.** There is no `--from-finding` (and no `resolve` command yet),
  so a finding stays listed in `next` until resolved by hand. The block text says
  this plainly so the proposer isn't misled. This matches the scope agreed with
  the user: only `next` as the first piece; `plan`/`do` consumption stay as
  follow-ups.
- **No cap on the list.** `listFindings` returns all open findings across phases;
  on a project with many findings the block could grow large (same as the todo
  block, which also has no cap). Left unbounded for now by agreement.

## Open item for the human

- The temporary `.mini/findings/` directory from my live test must be deleted
  before `mini done` (see the `verify` entry above) — I was blocked from removing
  it.
