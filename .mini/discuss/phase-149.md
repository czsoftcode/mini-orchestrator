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
