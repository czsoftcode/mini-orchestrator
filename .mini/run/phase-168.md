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
