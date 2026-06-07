---
phase: 149
verdict: done
steps:
  - title: "buildProjectSessionPrompt with 4-stage protocol"
    status: done
  - title: "context project branch (no active phase)"
    status: done
  - title: "CLI project command + interactive session"
    status: done
  - title: "COMMAND_DEFS entry + install snapshot"
    status: done
  - title: "docs/interactive/project.md"
    status: done
  - title: "Green: npm test + npm run build"
    status: done
verify:
  - title: "Try the live /mini:project conversation and judge its quality"
    detail: "The bare interactive session (workWithClaude) and the actual chat quality of the 4-stage interview can't be tested mechanically — only the prompt text is asserted. To try it live you must first deploy this build: install it globally (npm i -g / npm link) and run `mini install-commands` so the global `mini` and the generated /mini:project slash exist (the currently installed global binary is the older version and does not know the project command yet)."
---

# Phase 149 — report from the auto session

Part 1c of the `mini project` design: `/mini:project` + bare `mini project` are
wired on top of phase 148's parser/apply. Six files changed/created, all per the
discussion notes (`.mini/discuss/phase-149.md`). The conversation protocol came
from the user in `/mini:discuss` and was distilled (not pasted verbatim) into the
session prompt.

## What was built
- **`src/prompts/sessionContext.ts`** — `buildProjectSessionPrompt(projectMd)`:
  inlines the current project.md, frames it as enriching an existing project (do
  NOT re-ask the idea), runs the 4-stage interview (frame → rough plan with
  pros/cons/alternatives → non-goals as rules → final check + Success), stays
  critical, keeps existing NAME/FOR_WHOM/CONSTRAINTS, and saves via a heredoc
  `mini project --apply` contract. Covered by 3 new unit tests.
- **`src/commands/context.ts`** — `'project'` added to `CONTEXT_COMMANDS`, routed
  in `context()` before `buildPhaseContext` (no active phase needed, like `next`);
  `buildPhaseContext`'s param type narrowed to
  `Exclude<ContextCommand, 'next' | 'project' | 'verify'>`.
- **`src/commands/project.ts`** — new `projectSession()` (interactive bare session,
  modeled on `discuss.ts`) with `allowedTools` including **Bash** so the agent can
  run `mini project --apply` itself.
- **`src/cli.ts`** — `program.command('project')`: `--apply` reads stdin →
  `parseProjectContract` → readable error + exit 1 on `null` → `applyProject`; bare
  runs `projectSession()`. Added `project` to the `context` command's description.
- **`src/install/commands.ts`** — `COMMAND_DEFS` entry `project` (thin default body
  → `mini context project`, generates the `/mini:project` slash).
- **`docs/interactive/project.md`** + **`docs/non-interactive/project.md`** — command
  docs (the second one added to avoid a dangling cross-link; `mini project` is a
  real CLI command, every command has both doc forms).

## Verification (mechanical, done here)
- `npm test` — 949 pass (74 files). Updated three snapshots/assertions that an
  added command legitimately changes: `install-commands.test.ts` (sorted list +
  `project.md`), `install.test.ts` (count 19 → 20), `context.test.ts`
  (`CONTEXT_COMMANDS` + `isContextCommand('project')`).
- `npm run build` — clean.
- Smoke test of the built `dist/cli.js` in temp dirs (the real project's
  `project.md` was left untouched):
  - `mini context project` prints the prompt with the current project.md inlined.
  - `mini project --apply <<'EOF' …` → writes the new Approach/Non-goals/Success
    sections, keeps the existing NAME/FOR_WHOM/CONSTRAINTS, and `status --json`
    shows phases still `[]` (state.json untouched).
  - bad contract (no NAME/WHAT) → readable error, exit 1.
  - valid contract but no project → "Run mini init first", exit 1.

## Notes / open questions
- No real rejected alternative arose during implementation (the design was settled
  in discuss) — `/mini:decision` not needed.
- **Deployment caveat:** `/mini:project` will not work in a live Claude session
  until this build is installed globally and `mini install-commands` regenerates
  the slash files — the currently installed global `mini` predates the command.
  This is normal for any new command, just flagging it for the live tryout.
- Token cost: the whole project.md is inlined every `/mini:project` (accepted);
  reference mode is the separate phase 36 (todo 36).
- The detailed plan (flows/data/screens) is intentionally NOT persisted — only the
  distilled Approach/Non-goals/Success. A full planning doc would be a new feature.
