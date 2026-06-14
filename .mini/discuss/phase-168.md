# Phase 168 — Document adversarial-project command

## Intent
Close the docs gap for the adversarial review commands. Backlog item [7] listed
four parts, but three are already satisfied:
- `mini --help` entry — already present (commander auto-generates help from the
  command definition; `adversarial-project` is registered).
- `mini doctor` "counts" the command — already done. doctor compares
  `installedCommands` (files in COMMANDS_DIR) vs `expectedCommands =
  COMMAND_DEFS.length`; `adversarial-project` is in COMMAND_DEFS (src/install/commands.ts:114),
  so it is already counted. No doctor change needed.
- CHANGELOG — written automatically by `/mini:done`, not an implementation step.

So the real work is **documentation only**.

## Key decisions
- **Scope = both commands.** Document `adversarial` AND `adversarial-project`.
  Both are currently undocumented (no pages in docs/interactive/ or
  docs/non-interactive/, no row in docs/README.md). They are a pair (single
  phase vs. range of phases); documenting only one is inconsistent. This goes
  slightly beyond the literal backlog [7] wording (adversarial-project only) —
  deliberate.
- Each command has BOTH an interactive `/mini:*` slash variant and a
  non-interactive `mini *` terminal variant, so they fit the existing
  two-variant doc pattern → add pages in `docs/interactive/` and
  `docs/non-interactive/` for both, following the structure/tone of the
  neighboring pages (e.g. verify.md, findings.md).
- **README pointer goes into `docs/README.md`** command-reference tables (the
  top-level README.md was deliberately slimmed in phases 131-146 and points to
  docs/). Add a new row/section for the adversarial review commands, near the
  existing `mini findings` row (the "Adversarial review findings" row).
- **Redirect findings.md link.** `docs/non-interactive/findings.md:9` currently
  links "adversarial review" to `../adversarial-task.md` (a Czech dev spec).
  Point it at the new real reference page instead.
- Docs are English (project rule).

## Watch out for
- Do NOT touch `mini --help`, COMMAND_DEFS, or doctor logic — those parts are
  already done; re-doing them is wasted work / risk. Verify-only.
- Keep it manual-only: no `auto`/heuristic wiring for these commands (by design).
- The Czech task-spec files `docs/adversarial-project-task.md` and
  `docs/adversarial-task.md` are dev specs, NOT user reference, and violate the
  English-docs rule. Leaving them as-is is in scope; cleaning/removing/translating
  them is OUT of scope (separate todo).
- Cross-link the new pages to their sibling variant and related commands
  (findings, verify, done) like the other doc pages do, so the reference stays
  consistent.
- adversarial-project takes a range (--from-phase/--to-phase or --from/--to incl.
  genesis fallback) — make sure the non-interactive page documents the flags
  accurately against the actual CLI (don't invent options).
