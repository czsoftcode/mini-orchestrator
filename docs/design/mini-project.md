# Plan: new command `mini project` / `/mini:project`

> Internal design note (working document). Captures the agreed design for the
> `mini project` feature so it can be driven through the mini workflow.

## Context (why)

Today `mini init` produces only a terse `.mini/project.md` from four short
answers (What I'm building / Who it's for / Main constraints). That gives the
agent no guidance on **how** to approach the project nor **where not to go**.
Because `project.md` is inlined into the `next`, `plan`, `do`, `discuss`,
`audit` and `memory` prompts, it is the single central place where we can steer
the agent.

The goal is a **separate** command `mini project` / `/mini:project` that, after
`init`, asks the user about the vision and enriches `project.md` with the
sections **Approach**, **Non-goals** and **Success criteria**. Decisions
confirmed with the user:

- saving goes through the **`mini project --apply` contract** (one source of
  truth, like `init` / `import-gsd`), not a direct write by the agent;
- it **enriches after init** — it requires an existing project, it does not
  create one;
- new sections: **Approach + Non-goals + Success criteria** (the existing What /
  Who / Constraints stay).

## Key risk that drives the design

`src/commands/status.ts` parses `project.md` with regexes and relies on the
headings `# <name>` and `## What I'm building` (lines ~77, 85, 355). **These
headings must not be renamed or structurally moved** — we only add new sections,
otherwise `mini status` breaks.

Second trade-off: a richer `project.md` = more tokens, because today most steps
inline the **whole** text. **Part 2** below addresses this: **reference mode** —
in a warm session project.md is only referenced (read-once), and inlined only in
a cold context (a session opener after `/clear` and headless calls).

## Approach (recommended)

The command is **session-first**, like `discuss`/`decision`:

1. `/mini:project` (slash) → a thin body runs `mini context project`, which
   prints a session prompt into the running Claude Code session. The agent reads
   the current `project.md`, interviews the user and, after approval, sends a
   **contract** via heredoc to `mini project --apply`.
2. `mini project` (bare in the terminal) → runs an interactive Claude session
   via `workWithClaude` with the **same** prompt (mirrors `discuss.ts`) — no
   fragile parsing in the terminal.
3. `mini project --apply` → reads the contract from stdin, parses it, renders
   `project.md` through the **shared** renderer and writes it atomically.
   Changes **only** `project.md`, never `state.json`.

### Files to create / change

**New:**

- `src/state/projectMd.ts` — move the shared `renderProjectMd(fields)` here.
  Fields: `name, what, forWhom, constraints` + **optional** `approach, nonGoals,
  success`. The optional sections render **only when filled in**. Section order:
  `# name` → What I'm building → Who it's for → Approach → Non-goals → Success
  criteria → Main constraints. **Critical:** when all optional fields are
  omitted, the output must be **byte-for-byte** identical to today's
  `renderProjectMd` in `init.ts` (otherwise `init.test.ts` /
  `import-gsd.test.ts` break).
- `src/commands/project.ts`:
  - `applyProject(parsed, cwd?)` — modeled on `applyInit`/`applyPlanSteps`:
    checks `exists(cwd)` (otherwise an error “run mini init first”), renders via
    the shared renderer, `writeProject`. Returns `{ ok }`.
  - `parseProjectContract(stdin)` — a **block** parser modeled on the
    `import-gsd` parser (`src/commands/import-gsd.ts`). Labels `NAME: / WHAT: /
    FOR_WHOM: / CONSTRAINTS: / APPROACH: / NON_GOALS: / SUCCESS:`; each field's
    value runs **up to the next known label or EOF** (must handle multi-line
    bullet sections), `trim` at the end. This is the main implementation risk —
    cover with tests (multi-line, empty optional, a label inside the text).
- `src/commands/project.test.ts` — `applyProject` renders the sections and keeps
  the `## What I'm building` heading; fails without a project; parser tests.
- `docs/interactive/project.md` — command documentation (modeled on `init.md`).

**Change:**

- `src/commands/init.ts` and `src/commands/import-gsd.ts` — replace the local
  `renderProjectMd` / `buildImportProjectMd` with an import of the shared
  `src/state/projectMd.ts` (they call it without optional fields → output
  unchanged).
- `src/prompts/sessionContext.ts` — add `buildProjectSessionPrompt(projectMd)`
  (model: `buildPlanSessionPrompt`). Skeleton: read the current `project.md`,
  interview the user (vision → richer What, Approach, Non-goals, Success),
  **keep** NAME/FOR_WHOM/CONSTRAINTS from the existing `project.md` (do not drop
  them), show a draft for approval and only then a heredoc contract into
  `mini project --apply`. Remind to “keep sections concise”.
  - **The communication protocol comes from the user.** The exact instructions
    for how `project` should run the conversation with the human (what to ask,
    in what order, how hard to push for clarification) **will be supplied by the
    user during development in discussions**. At implementation time, request
    them from the user and put them into the body of this prompt; until then
    leave a clearly marked placeholder there, not an invented script.
- `src/commands/context.ts` — add `'project'` to `CONTEXT_COMMANDS` and in
  `context()` add a branch `else if (cmd === 'project') prompt =
  buildProjectSessionPrompt(projectMd);` **outside** `buildPhaseContext`
  (project needs no active phase — the top-level `exists` check is enough).
- `src/cli.ts` — a new `program.command('project')` block modeled on `init`:
  `--apply` reads stdin (`readStdin()` → `parseProjectContract` →
  `applyProject`); the bare branch runs an interactive session like `discuss`.
  Optionally add `'project'` to the `context` command description (line ~408).
- `src/install/commands.ts` — add an entry to `COMMAND_DEFS` (`name: 'project'`,
  description, **default** body → generates `mini context project`).
- `src/commands/install-commands.test.ts` — into the expected sorted list (lines
  21–41) insert `'project.md'` **between `'plan.md'` and `'status.md'`**.
- Docs: `README.md` (quick start: `/mini:project` as an optional deepening step
  after init), `docs/files.md` (the new `project.md` sections), `docs/context.md`
  (a note about the higher token count).

### What is deliberately NOT done

- **No new model scope** in `src/state/models.ts` — both the bare and slash form
  run through a user Claude session (`workWithClaude`), not the headless
  `askClaude`, so no model is resolved. `models.ts` stays untouched.
- **No write to `state.json`** — the command touches only `project.md`.
- `status.ts` regexes are **not changed** (headings preserved).

## Part 2: reference mode for `project.md` (replaces selective sections)

Goal: inline `project.md` only where the agent does not yet have context; in a
warm session only **reference** it (read-once). Builds on the existing
`useProjectRef` for `do` (`src/prompts/autoPhase.ts:67-72`) and extends it to
`plan` and `discuss`. This removes the per-section parser from the earlier
version along with its risk of silently dropping a section.

### Two modes

- **Cold (inline the whole project.md):** session opener after `/clear` +
  headless one-shot calls. → `next`, `auto`, `audit`, `memory` and the
  interactive terminal `mini plan`/`mini discuss`/`mini next` (askClaude /
  workWithClaude = a fresh context with no history).
- **Warm (reference, do not inline):** slash steps running mid-session via
  `mini context …`. → `plan`, `discuss` (and `do`, which already references).
  `done`/`decision`/`verify` do not use project.md at all → no work.

### Shared reference block + the “cooling” nuance

Factor out a shared helper (e.g. `projectRefBlock()` in `src/prompts/`) so
`autoPhase`, plan and discuss share the same wording. Extend today's text for
`do` with the long-session nuance (confirmed by the user):

> The project is in `.mini/project.md`. If you already **have it in context**
> from earlier in this session, **do not read it again**. If you are unsure — a
> long session where it may have scrolled out of context (compaction), or a new
> session after a crash — read `.mini/project.md` (whole, once) via the Read
> tool. **Read it only when you don't have it.**

This also updates the existing `useProjectRef` text for `do` (consistency) —
an improvement, not a regression. Cover with the snapshot test
`autoPhase.test.ts`.

### Places to change

- `src/prompts/sessionContext.ts` — `buildPlanSessionPrompt`: add an optional
  `useProjectRef` (default inline, so the snapshot tests stay); when enabled,
  insert the reference block instead of `${projectMd}`.
- `src/prompts/discussPhase.ts` — `buildDiscussPhasePrompt`: the same.
- `src/prompts/autoPhase.ts` — rewrite the inline `useProjectRef` block to use
  the shared `projectRefBlock()` (with the nuance above).
- `src/commands/context.ts` — in the `plan` and `discuss` branches turn on
  `useProjectRef: true` (the warm slash path). Keep `next` inline (cold opener),
  `do` already references.
- The interactive terminal commands (`plan.ts`, `discuss.ts`) — keep them inline
  (cold), i.e. do not pass `useProjectRef`.
- **Drop** `parseProjectSections` / `selectProjectSections` and the per-section
  mapping from the earlier version — not needed. `src/state/projectMd.ts` holds
  only the shared `renderProjectMd` from Part 1.

### Risks (acknowledged)

- It relies on the model self-assessing “do I / don't I have it in context”; the
  wording therefore biases toward **“when unsure, read”**. The current `do`
  carries the same risk.
- Harder to test than inline — a test can only check that the warm prompt does
  **not** contain the whole project and **does** contain the instruction to read
  `.mini/project.md`; the actual agent behavior (whether it reads) is not covered
  by tests.

### Note on ordering

Part 2 depends only loosely on the sections from Part 1 (the reference block is
independent of the content). It can be a **separate mini phase** after Part 1 —
a smaller, more easily verifiable change.

## Verification (end-to-end)

1. `npm test` — the existing `init.test.ts`, `import-gsd.test.ts` must pass
   (proof that the shared renderer did not change the output) plus the new tests
   and the updated `install-commands.test.ts` snapshot.
2. `npm run build` (TS).
3. Manual smoke test in a temporary directory:
   - `mini init --apply --what "x" --for-whom "y"` → a basic `project.md` appears.
   - `printf 'NAME: …\nWHAT: …\nFOR_WHOM: …\nCONSTRAINTS: …\nAPPROACH: …\nNON_GOALS: …\nSUCCESS: …\n' | mini project --apply`
     → `project.md` contains the new sections and still has `## What I'm building`.
   - `mini status` → must not break (verifies the headings are preserved).
   - `mini install-commands --project --dry-run` → shows `project.md`.
   - `mini context project` → prints the session prompt; `mini project --apply`
     without an existing project → a readable error.
4. **Part 2 (reference mode)** — manual: `mini context plan` and `mini context
   discuss` do **not** contain the whole project.md, but **do** contain the
   instruction to read `.mini/project.md`; `mini context next` inlines the whole
   project. The snapshot test `autoPhase.test.ts` (and new ones for plan/discuss)
   verifies both `useProjectRef` branches (default inline vs. the reference block
   with the “read it only when you don't have it” wording).
