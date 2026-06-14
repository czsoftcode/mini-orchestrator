# Phase 154 — mini adversarial review command

## Intent
Add an independent red-team review step between `do` and `done`: a reviewer that
switches into the role of someone who did NOT write the code and actively hunts
for how it breaks (unhappy path, silent assumptions, premature complexity, gaps
in tests). Built by mirroring `verify`:
- `mini context adversarial` builds the prompt (new `adversarialContext.ts` +
  `buildAdversarialSessionPrompt` in `sessionContext.ts`, wired into `context.ts`
  and `CONTEXT_COMMANDS`).
- `mini adversarial` (new `adversarial.ts`) opens a Claude session, like `verify`.
- `/mini:adversarial` thin slash command via a new `COMMAND_DEFS` entry.
Findings + a status are written into the phase run report; the phase state is NOT
moved (that stays `done`'s job).

Out of scope (explicit follow-up phase): auto heuristic + `--adversarial` flag,
a dedicated `mini model adversarial` scope, `mini doctor` count, README/help.

## Key decisions
- **Independence comes from a fresh session, not from the prompt.** The CLI
  `mini adversarial` is the independent path: `workWithClaude` spawns a NEW
  `claude` subprocess = clean context by construction (runs from any terminal,
  even alongside the live session). This is the spec's "minimum = new session".
  Same model as the author for now (dedicated model scope is deferred — conscious).
- **Slash `/mini:adversarial` runs INLINE** in the current session (like
  `/mini:verify`), so it shares the author's context = no real independence. Its
  body must say so explicitly and point the user to run `mini adversarial` in a
  terminal, or `/clear` first, for a genuinely independent review. Do not pretend
  independence where there is none.
- **Findings location: report body, not the YAML header.** The reviewer appends a
  `## Adversarial findings` section at the END of `.mini/run/phase-{id}.md` (below
  the strict YAML front matter), exactly like verify writes `## Verify findings`.
  The status is the first (bold) line of that section: `adversarial: pass |
  findings | blocked`. The strict `parseRunReport` YAML header is NOT touched —
  the body flows into `done`/memory for free via `reportBody`. No parser change.
- **Reviewer finds the code via `git diff`.** Allowed tools = `Read, Edit, Grep,
  Glob, LS` plus read-only git through scoped Bash: `Bash(git diff:*)`,
  `Bash(git log:*)`, `Bash(git show:*)`. The prompt tells it to look at the real
  diff of what the phase changed — not to guess from the report alone. Full Bash
  is deliberately NOT granted.
- **Missing report: soft fallback.** If `.mini/run/phase-{id}.md` is absent, do
  not error (unlike `done`). Proceed from the git diff + phase goal + steps and
  say so. Supports red-teaming an in-progress phase that has no report yet.
- **Target phase = current, else last `done`** (mirror `verify` /
  `buildVerifyContext`).
- **No `--apply`** — adversarial never moves phase state, so there is no save
  contract (the spec's "--apply" is dropped on purpose).

## Watch out for
- Findings status is NOT machine-read in this phase. It lands as free text in the
  report body and reaches `done`/memory only as prose. Surfacing it in
  `mini status` / `summarizeRunReportText` is deferred — do not add a parser
  field now.
- The prompt for `mini context adversarial` is covered by a snapshot test (like
  the other prompts in `src/prompts/__snapshots__/`); changing the wording will
  need a snapshot update.
- `allowedTools` scoping (`Bash(git diff:*)` etc.) must actually restrict to
  read-only git — verify how `workWithClaude`/Claude Code interpret scoped Bash
  patterns before relying on it; if scoping can't be enforced, reconsider whether
  to grant Bash at all rather than granting full Bash.
- Reuse the existing report path/stem helpers (`runReportPath`, `phaseStem`) and
  the verify precedent for "report exists vs. not" — don't invent a new path.
- The reviewer must write findings even when it finds nothing: list concretely
  what was checked and how (per the spec's prompt), not a generic "looks good".
