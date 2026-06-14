# Phase 168 — Document adversarial-project command

**Goal:** Add user-facing docs for adversarial-project — a docs/ page plus a README pointer, a 'mini --help' entry, and make 'mini doctor' recognize/count the command — keeping it manual-only (no auto/heuristic wiring).

## Steps
- [done] Non-interactive page: mini adversarial
- [done] Non-interactive page: mini adversarial-project
- [done] Interactive pages: both slash commands
- [done] Add review commands to docs/README.md
- [done] Redirect findings.md adversarial link
- [done] Verify no code touched + links resolve

## Auto-commit
- Phase 168: Document adversarial-project command

## Discussion
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

## Run report
---
phase: 168
verdict: done
steps:
  - title: "Non-interactive page: mini adversarial"
    status: done
  - title: "Non-interactive page: mini adversarial-project"
    status: done
  - title: "Interactive pages: both slash commands"
    status: done
  - title: "Add review commands to docs/README.md"
    status: done
  - title: "Redirect findings.md adversarial link"
    status: done
  - title: "Verify no code touched + links resolve"
    status: done
verify:
  - title: "Read the four new doc pages for tone/accuracy"
    detail: "Wording, examples and the range-rules table were written by hand against the actual CLI/code; a human read for clarity and house style is worth one pass. Pages: docs/{interactive,non-interactive}/adversarial.md and adversarial-project.md."
---

# Phase 168 — report from the auto session

## What was done
Documented both adversarial review commands (single-phase `adversarial` and
range `adversarial-project`), which were entirely undocumented despite being
shipped in phases 154–167.

- New pages, following the existing `verify.md` two-variant template:
  - `docs/non-interactive/adversarial.md`
  - `docs/non-interactive/adversarial-project.md` (range flags documented against
    the real CLI `--help` + verified against `src/range.ts`: phase vs. git-ref
    forms, mutual exclusion, and the genesis fallback for the first phase)
  - `docs/interactive/adversarial.md`
  - `docs/interactive/adversarial-project.md`
- `docs/README.md`: added a new **Review** section grouping `adversarial`,
  `adversarial-project` and `findings`; removed the now-redundant "Adversarial
  review findings" row from *State & control* (findings moved into Review).
- `docs/non-interactive/findings.md`: the "adversarial review" link pointed at
  the Czech dev spec `../adversarial-task.md`; repointed it to the new
  `adversarial.md` reference page.

## What was NOT done (deliberately)
The backlog item [7] listed three more parts that turned out to be **already
satisfied** — confirmed, not re-done:
- `mini --help` already lists `adversarial-project` (commander auto-generates it).
- `mini doctor` already counts it: it compares installed slash-command files vs
  `COMMAND_DEFS.length`, and the command is in `COMMAND_DEFS`.
- CHANGELOG is folded automatically by `/mini:done`.

So no `src/` was touched (git status confirms only docs + `.mini/` state files).

## Verification done mechanically
- Link check: every relative link in the 4 new pages + the 2 edited files
  resolves to an existing file (script in the session) — all OK.
- `npm run typecheck` — clean.
- `npm test` — 83 files, 1141 tests, all pass.

## Out of scope (noted for a future todo)
The Czech dev-spec files `docs/adversarial-project-task.md` and
`docs/adversarial-task.md` remain in the repo and violate the English-docs rule.
Cleaning/translating/removing them was intentionally left out of this phase.
