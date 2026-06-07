# Phase 149 — mini project session flow

**Goal:** Wire the full /mini:project (Part 1c) on top of phase 148: buildProjectSessionPrompt in sessionContext.ts (keep existing NAME/FOR_WHOM/CONSTRAINTS, interview for vision/Approach/Non-goals/Success, emit a heredoc contract to 'mini project --apply'), a 'project' branch in context.ts + CONTEXT_COMMANDS (no active phase needed), the CLI 'project' command (bare interactive via workWithClaude like discuss.ts + --apply reading stdin -> parseProjectContract -> readable error on null -> applyProject), a COMMAND_DEFS entry generating the /mini:project slash, docs/interactive/project.md, and the install-commands.test.ts snapshot (insert 'project.md' between 'plan.md' and 'status.md'). The conversation protocol for the session prompt is supplied by the user in /mini:discuss; fall back to a clearly marked placeholder per docs/design/mini-project.md only if not supplied. No model scope, no state.json writes, no status.ts changes.

## Steps
- [done] buildProjectSessionPrompt with 4-stage protocol
- [done] context project branch (no active phase)
- [done] CLI project command + interactive session
- [done] COMMAND_DEFS entry + install snapshot
- [done] docs/interactive/project.md
- [done] Green: npm test + npm run build

## Auto-commit
- Phase 149: mini project session flow

## Discussion
# Phase 149 — mini project session flow

## Intent
Part 1c of the `mini project` design (`docs/design/mini-project.md`): wire the full
`/mini:project` + bare `mini project` on top of phase 148's parser/apply. The
command runs **after `mini init`** and **enriches the existing `project.md`** with
the optional sections Approach / Non-goals / Success criteria (the existing
What / Who / Constraints stay). Saving goes through the phase-148 contract
(`mini project --apply`), never `state.json`.

`project.md` stays a **distilled one-page steering doc** — only the main points
from the conversation are written, not the full plan (confirmed by the user). The
rich planning method below is the *process* to fill the three slots well; detailed
flows / data objects / screens inform Approach but are NOT persisted verbatim
(project.md's renderer/parser from 147/148 have only the fixed sections).

## Key decisions

### Conversation protocol (supplied by the user, distilled into agent instructions)
The session prompt instructs the **agent** to run a plan-before-code interview in
4 stages, mapping onto project.md's three new slots. Source: the user's prepared
prompt blocks — rewritten from the user's voice into agent-directed steps, and
**condensed** (do NOT paste the blocks verbatim — the prompt is paid in tokens on
every `/mini:project`; keep the spirit). Tone throughout: critical, not
agreeable — give pros/cons + at least one alternative, say when an idea is bad.

1. **Frame & remove assumptions.** Reflect back what `project.md` currently says
   (What / Who / Constraints) — do NOT ask the user to "describe the idea", it is
   already there. Then ask assumption-removing questions **in small batches** so
   the user can actually answer: about the users, the core workflow, the data, the
   screens. (No output field yet — groundwork.)
2. **Draft the plan & weigh decisions.** Propose a short, rough plan: main user +
   their main job, 3-5 core flows, key data objects, main screens, the risky
   unhappy paths (corrupt data / leak permissions / cost money). For each major
   decision give pros, cons and ≥1 alternative; challenge the user, ask "why is X
   right vs the simplest version?". → distil into **Approach**; may sharpen
   **What**.
3. **Non-goals & guardrails.** Turn the "not building yet" list into **Non-goals**,
   each phrased as a droppable rule ("Do not add X in this version."). Also: the
   agent lists what *it* would be tempted to add that the user did NOT ask for
   (extra features/structure/integrations) and, per item, recommends build-now or
   leave-out; the left-outs become more non-goals.
4. **Final check & Success.** Ask: "is there any question that, answered wrong,
   would send us down the wrong path?" — if yes, ask it now. Then define
   **Success criteria** (how we know it's done/good). Show the full draft
   `project.md` for approval, and only then emit the contract.

### Output contract & writing
- **Keep existing NAME / FOR_WHOM / CONSTRAINTS** from the current project.md —
  re-send them unchanged in the contract (the "full replace" path from phase 148
  relies on the agent carrying them; dropping one would lose it). Only change them
  if the user explicitly asks.
- **Emit the contract via heredoc**, not `printf` — Approach/Non-goals/Success are
  multi-line bullet sections and `printf`-per-line (like `decision`) would be
  unreadable. Give the exact template in the prompt, e.g.:
  ```
  mini project --apply <<'EOF'
  NAME: ...
  WHAT: ...
  FOR_WHOM: ...
  CONSTRAINTS: ...
  APPROACH:
  - ...
  NON_GOALS:
  - Do not ...
  SUCCESS:
  - ...
  EOF
  ```
  Labels must start at column 0 (parser rule from phase 148). Omit an optional
  label entirely when its section is empty.
- "Keep sections concise" reminder (one-pager, not a spec).

### Wiring (mechanical, modeled on existing code)
- `src/prompts/sessionContext.ts`: `buildProjectSessionPrompt(projectMd)` — model
  the structure on `buildPlanSessionPrompt` / `buildNextSessionPrompt`. Inline the
  whole current `project.md` (the agent needs the current values; reference mode is
  phase 36, not here).
- `src/commands/context.ts`: add `'project'` to `CONTEXT_COMMANDS`; route it in
  `context()` as its own branch **before** `buildPhaseContext` (project needs no
  active phase — the top-level `exists` check is enough), like `next`/`verify`.
  Update `buildPhaseContext`'s param type to `Exclude<ContextCommand, 'next' | 'verify' | 'project'>`.
- `src/cli.ts`: `program.command('project')` modeled on `init` + `discuss`:
  - `--apply` → `applyProject(parseProjectContract(await readStdin()))`; on parser
    `null` print a **readable error** (mention required NAME/WHAT) and set a
    non-zero exit code.
  - bare (no `--apply`) → interactive session via `workWithClaude` like
    `discuss.ts`, BUT `allowedTools` MUST include **`Bash`** (the agent runs
    `mini project --apply` at the end) plus Read/Grep/Glob/LS. Confirm prompt +
    "no project → run mini init first".
- `src/install/commands.ts`: `COMMAND_DEFS` entry `name: 'project'` (default body →
  `mini context project`).
- `src/commands/install-commands.test.ts`: insert `'project.md'` into the expected
  sorted list **between `'plan.md'` and `'status.md'`**.
- `docs/interactive/project.md`: command docs, modeled on `init.md`.

## Watch out for
- **Scope from phase 148 is reused, not re-built** — import `parseProjectContract`
  / `applyProject` from `src/commands/project.ts`. Do not touch the renderer
  (`projectMd.ts`), the parser, `status.ts`, or `state.json` writing.
- **Bash in allowedTools for the bare session** is the real difference from
  `discuss` (which is Read/Write only). Without it the agent cannot save. Trade-off:
  broader permissions — mitigate by the prompt naming exactly the one command to run.
- **Don't paste the user's blocks verbatim** — distil; the prompt cost is paid per
  invocation.
- **No model scope** (`models.ts` untouched) — both forms run a user Claude session
  (`workWithClaude`), not headless `askClaude`.
- **Token cost** of inlining the whole project.md every `/mini:project` is accepted
  here; reference mode is the separate phase 36 (todo 36).
- Snapshot test position matters: `'project.md'` is alphabetically between
  `plan`/`status`; a wrong position fails `install-commands.test.ts`.
- Forward note: the detailed plan (flows/screens/data) is intentionally NOT
  persisted — if the user later wants a full planning doc, that's a new feature
  (candidate for `mini todo`), not this phase.

## Run report
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
