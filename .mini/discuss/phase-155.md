# Phase 155 — Adversarial findings store

## Intent
Today the adversarial reviewer writes findings with `Edit` into the **run report
of the phase under review** (`.mini/run/phase-XXX.md`). After the phase closes
nobody opens that file again, so the finding is buried and cannot feed later work.

This phase introduces a dedicated, durable store `.mini/findings/` plus a
`mini findings add` command that **mini owns** (path + format + origin phase +
open/resolved status). The reviewer stops editing the run report and instead
records each finding by calling the CLI; it only reports and never touches source
code. Reading/consuming the store in `next`/`plan`/`do` and a `resolve` command
are explicit **follow-up phases** — this phase only writes and lists.

Combines backlog items [42] (separate directory, reusable across phases) and [37]
(adversarial only reports, never modifies code).

## Key decisions
- **Store-only.** Adversarial findings go ONLY to `.mini/findings/`, no copy into
  the run report. Accepted consequence: until the consume phase exists,
  `done`/memory will NOT see adversarial findings (the model still prints its
  pass/findings status line to the human in chat).
- **Scope = `add` + read-only `list`.** `mini findings add` (called by the model)
  and `mini findings list` (so a human can see the store and verify the phase).
  `resolve` (flip open→resolved) and consumption in next/plan/do are later phases.
- **Mechanical enforcement on the CLI path.** In `mini adversarial`
  (`ADVERSARIAL_ALLOWED_TOOLS`), drop `Edit` and replace it with a scoped
  `Bash(mini findings add:*)`. The reviewer then cannot edit any file — it can
  only read, run read-only git, and record findings via the CLI. Keep
  `Read`/`Grep`/`Glob`/`LS` + `Bash(git diff|log|show:*)`. The `/mini:adversarial`
  slash path runs in the user's own session — tools can't be restricted there, so
  report-only holds by the prompt instruction alone (same CLI-vs-slash asymmetry
  as before).
- **Origin phase is inferred by mini**, not passed by the model — same selection
  as `buildAdversarialContext` (current phase, else last `done`). One less thing
  for the model to get wrong.
- **Format contract (lock now to avoid a later migration), per the
  decisionStore/todoStore precedents:**
  - One file per origin phase: `.mini/findings/phase-{id}.md` (reuse `phaseStem`).
  - The file holds MULTIPLE finding entries (a red-team yields several) — this is
    the one place that goes beyond decisionStore (one-per-phase) and todoStore
    (flat checklist): findings need per-entry machine-readable **status** for the
    later `resolve`/consume phases. That justifies a real parse contract here.
  - Each entry starts with a section header carrying a **stable unique id**, the
    **severity** (`blocker|should-know|nit`) and a single **status token**
    (`open|resolved`) that a later `resolve` flips on one line; the body follows
    (where `file:line`, what/how). Exact section shape is a plan detail, but id +
    severity + single-token status must be present from day one.
  - Id scheme: sequential within the phase file (e.g. `155-1`, `155-2`); `add`
    reads the existing file, computes the next index, appends (read-modify-write,
    sequential CLI calls — no concurrency).
- **`list` defaults to open findings across ALL phases** (scan the directory),
  not just the current one — that is the cross-phase reuse the store exists for; a
  flag may include resolved.
- **Findings are versioned (committed), like `.mini/decisions/` and
  `.mini/memory/`** — durability across sessions is the goal. Make sure the
  skeleton `.gitignore` does NOT exclude `.mini/findings/` (unlike `.mini/run/`,
  which is a generated artifact).
- **Simplify the prompt.** Since writing no longer targets the run report, the
  three-state report-write machinery (`valid`/`corrupt`/`missing` →
  append/fail-loud) in `adversarialContext.ts` + `sessionContext.ts` collapses:
  the prompt just says "record each finding via `mini findings add`". KEEP reading
  `reportBody` as **context** for the reviewer (still useful); only the
  write-branching and the `memoryWrite` block go away.

## Watch out for
- **`mini` must be invocable in the session that runs the review.** The model has
  to actually run `mini findings add ...`; that depends on how `mini` is on PATH
  (global install vs `npm link` in this repo vs `node dist/cli.js`). If the
  command name doesn't match the environment, every finding silently fails to
  record. Verify the invocation the prompt tells the model to use matches reality;
  consider having `add` print a clear confirmation (assigned id + path) so a
  failed call is visible, not silent.
- **Scoped-Bash enforcement is unproven** (same caveat as phase 154's
  `Bash(git diff:*)`). If Claude Code does not actually restrict
  `Bash(mini findings add:*)` to that subcommand, the "reviewer can't edit code"
  guarantee is weaker than it looks — but dropping `Edit` is still a strict
  improvement over today. Don't claim hard enforcement without checking.
- **Clean reviews leave no trace.** A zero-finding review writes nothing, so
  "no findings file" is ambiguous (never reviewed vs reviewed-clean). Acceptable
  for this phase (status line goes to chat); recording a "review ran, clean"
  marker is a possible follow-up — do NOT invent machine state for it now.
- **Tests:** mirror `decisionStore.test.ts`/`todoStore.test.ts` for the new store
  (parse/serialize or add/list round-trip, id assignment, missing-dir → empty,
  malformed entries ignored). Update the adversarial prompt **snapshot** (it will
  change). Extend `adversarial.test.ts` to assert the new `allowedTools` set
  (Edit gone, `Bash(mini findings add:*)` present) reaches `workWithClaude`.
- **Don't build `resolve`, doctor orphan-check, undo integration, or the
  next/plan/do consumption here** — all follow-up phases. Keep this one to the
  store + `add` + `list` + the adversarial rewire.
- **`list` on an empty/missing store must not error** — print "no open findings",
  like `listDecisionPhaseIds` returning an empty set for a missing directory.
