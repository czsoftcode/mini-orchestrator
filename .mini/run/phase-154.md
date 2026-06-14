---
phase: 154
verdict: done
steps:
  - title: "Adversarial prompt builder + context wiring"
    status: done
  - title: "mini adversarial interactive CLI command"
    status: done
  - title: "/mini:adversarial slash command"
    status: done
  - title: "Tests: prompt snapshot + wiring"
    status: done
verify:
  - title: "Run an actual mini adversarial session and confirm the scoped git Bash really restricts to read-only git"
    detail: "Could not be verified without spawning a live Claude session. Check that git diff/log/show work but other Bash is blocked, and that findings land as an '## Adversarial findings' section with the status line."
---

# Phase 154 — report

## What was built
An independent red-team review step, mirroring `verify`:

- **`buildAdversarialSessionPrompt`** in `src/prompts/sessionContext.ts` — the
  reviewer is told to switch into the role of someone who did NOT write the code,
  read the real `git diff`, and go through 4 areas (unhappy path / silent
  assumptions / premature complexity / tests). Findings go into an
  `## Adversarial findings` section in the report **body** (below the strict YAML
  header, like verify), starting with a status line `**adversarial: pass |
  findings | blocked**`. The phase state is NOT moved.
- **`src/commands/adversarialContext.ts`** — `buildAdversarialContext` /
  `buildAdversarialPrompt`, target = current phase else last `done` (mirrors
  `verifyContext.ts`); reuses `readReportVerify` just for the report body.
- **`context.ts`** — `adversarial` added to `CONTEXT_COMMANDS` + dispatch; the
  `mini context` description updated.
- **`src/commands/adversarial.ts`** — interactive `mini adversarial`, modeled on
  `verify.ts`, with `allowedTools = Read, Edit, Grep, Glob, LS` + scoped read-only
  git `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git show:*)`. Registered in
  `cli.ts`.
- **`/mini:adversarial`** slash command in `install/commands.ts` with a custom
  body whose first block is the independence caveat (inline = shares the author's
  context → run `mini adversarial` in a terminal, or `/clear` first). Hint lines
  in `install-commands.ts` and `install/commands.ts` updated.
- **Tests**: prompt assertions in `sessionContext.test.ts`, routing in
  `context.test.ts`, slash-command checks in `install-commands.test.ts`; the
  command-count assertions (`install.test.ts`, the file list) bumped 20 → 21.
  All 1014 tests pass; `tsc --noEmit` clean.

## Deviations from the plan
- The plan said "snapshot test"; I followed the actual sibling precedent
  (`buildVerifySessionPrompt` is tested with `.toContain` assertions, not
  snapshots — session prompts have no `__snapshots__` entries). So the prompt is
  covered by assertions, which is more robust to wording tweaks.
- `mini doctor` already counts commands dynamically via `COMMAND_DEFS.length`, so
  the new command is counted with no change needed.

## Adversarial self-check (unhappy paths I checked)
- No project → `context` exits 1 before building anything. ✓
- No current and no closed phase → `buildAdversarialContext` returns null, logs a
  hint, exit 1. ✓ (test)
- **Bug I found and fixed in my own code:** when the report file exists but is
  empty/unparseable (`reportExists=true`, `body=undefined`), the prompt used to
  say both "add a section to the existing report" AND "there is no report yet" —
  a contradiction. Fixed by branching the body block on `reportExists`, not just
  on the body text.

## For the human / open questions
- **Scoped Bash enforcement is unverified at runtime.** The tokens
  `Bash(git diff:*)` etc. are passed correctly to `--allowed-tools` (verified the
  comma-join), but whether Claude Code actually restricts Bash to *only* read-only
  git was NOT verified live (it needs spawning a real session). If the scoping
  doesn't hold, the reviewer could get broader Bash than intended — re-check, or
  reconsider granting Bash at all. This is the main thing worth a human eye.
- Independence is "fresh context, same model" by design (the dedicated
  `mini model adversarial` scope is deferred). The slash path is honest about
  sharing context but cannot enforce independence.
- Deferred to a follow-up phase (as agreed): auto heuristic + `--adversarial`
  flag, machine-readable status in `mini status`/`summarizeRunReportText`,
  `mini model adversarial` scope, README/`mini --help` docs.

## Adversarial findings

**adversarial: findings**

> Independence caveat: this review ran **inline in the same session** that wrote
> the code (slash-command path), so it shares the author's context and blind
> spots. Treat the findings as a same-author sanity pass, not a truly independent
> red-team. Live-checked: `mini context adversarial` prints the full prompt for
> the current phase (154); the 5 touched test files pass (126 tests).

- **[should-know] No-report soft-fallback can write a structurally invalid run
  report whose own findings then become invisible.**
  `src/prompts/sessionContext.ts:483-485` (the `reportWrite` else-branch) +
  `src/commands/adversarialContext.ts:44-49`. When `reportExists` is false the
  prompt tells the model to `Write` a brand-new `.mini/run/phase-XXX.md`
  containing "at least an `## Adversarial findings` section" — i.e. **no YAML
  front matter, no `phase:`/`steps:`/`verdict:`**. `parseRunReport`
  (`src/state/runReport.ts:138-142`) rejects exactly that with
  `RunReportParseError("Report neobsahuje YAML front matter…")`. Two consequences:
  (1) for a `doing` phase where `do` was skipped, `mini done --auto` can never
  auto-advance off this file — it always drops to the interactive fallback, and
  `runReportExists` now returns true so only a later `mini do` overwrites it;
  (2) `readReportVerify` catches the parse error and returns `body: undefined`,
  so the reviewer's own findings written into that YAML-less file are **silently
  dropped** from every later `verify`/`done`/`adversarial` prompt. The reviewer
  thinks the findings are recorded for the workflow; they're only in chat + a
  dead file. Edge (normal flow do→adversarial→done always has a report), but it
  fails silently rather than loudly. Minimum fix: have the prompt create a valid
  report (YAML header with `phase`, `verdict`, real `steps`) before appending the
  section, or refuse to create one and just emit findings to the human.

- **[should-know] The interactive command `mini adversarial` has zero test
  coverage, breaking the sibling precedent.** `src/commands/adversarial.ts` (new,
  89 lines) has no `adversarial.test.ts`, yet `src/commands/verify.test.ts` exists
  with 4 cases — including one that asserts the exact `allowedTools` set reaches
  `workWithClaude` (`verify.test.ts:90`). The riskiest, **novel** part of this
  phase is the scoped-Bash grant `Bash(git diff:*)`/`Bash(git log:*)`/
  `Bash(git show:*)` (`adversarial.ts:13-22`) — a pattern that exists nowhere
  else in `src/` (grep for `Bash(git` finds only this file). The author honestly
  flagged that runtime enforcement is unverified, but there isn't even a unit test
  asserting these tokens are passed to `workWithClaude` unchanged, nor coverage of
  the no-project guard / cancel / non-zero-exit branches that verify.ts has. A
  typo in a Bash scope token would ship undetected.

- **[nit] The two install hint lines drifted further apart.**
  `src/commands/install-commands.ts:41` now lists both `/mini:verify` and
  `/mini:adversarial`; `src/install/install.ts:81` lists `/mini:adversarial` but
  still omits `/mini:verify` (and omits `/mini:model`, lists `/mini:upgrade`
  instead). Pre-existing drift, but this phase edited both lines and left them
  inconsistent — the user sees a different command list depending on which
  install path ran. No test pins either list's contents (only the file count is
  asserted, install.test.ts:48), so the drift is invisible to CI.

- **[nit] `mini context` description still omits `decision`.** `src/cli.ts:438`
  lists `next|project|discuss|plan|do|done|verify|adversarial` but not
  `decision`, which is a valid `CONTEXT_COMMANDS` entry. Pre-existing (not
  introduced here), noted because the line was edited in this phase.

### Checked and found clean
- Exit-code handling for the null prompt: `context.ts:77-80` sets
  `process.exitCode = 1` and returns; covered by the new "no current or closed
  phase → exit code 1" test.
- The three-way `bodyBlock` / `reportWrite` branching correctly avoids the
  self-contradiction the author called out (report exists but unparseable →
  `body: undefined`, `reportExists: true` → neither "add to existing" nor "no
  report yet" text is wrong). Verified by the `reportExists: true/false` tests.
- `phaseDone` framing and the memory-write block only render for closed phases;
  the "not yet closed" path correctly omits `.mini/memory/...` (tested).
- Live happy path: `mini context adversarial` on the current phase prints the
  full red-team prompt with the correct phase id, "not yet closed" frame, and the
  embedded implementation report body.

## Adversarial findings — resolution (round 1)
All findings from the round above were addressed before closing:

- **[should-know] #1 silent no-report fallback — FIXED.** The no-report branch in
  `buildAdversarialSessionPrompt` (`src/prompts/sessionContext.ts`) no longer tells
  the model to `Write` a YAML-less report (which `parseRunReport` rejects and
  `readReportVerify` silently drops). It now fails loudly: present the findings in
  the chat and point the user at `/mini:do` to get a proper report. Test updated
  (`sessionContext.test.ts`: asserts "Do not fabricate one" + `/mini:do`).
- **[should-know] #2 no test for `mini adversarial` — FIXED.** Added
  `src/commands/adversarial.test.ts` mirroring `verify.test.ts` (4 cases): no
  project, no phase, last-done fallback, and one that pins the exact `allowedTools`
  set — including the scoped `Bash(git diff:*)`/`Bash(git log:*)`/`Bash(git show:*)`
  tokens — so a typo in a Bash scope can't ship undetected.
- **[nit] #3 install hint drift — FIXED.** `src/install/install.ts` now lists
  `/mini:verify` alongside `/mini:adversarial`, matching `install-commands.ts`.
- **[nit] `mini context` description omitted `decision` — FIXED.** `src/cli.ts`
  now lists `…|done|decision|verify|adversarial`.

Still open: runtime enforcement of the scoped git Bash is unit-pinned now, but
whether Claude Code actually restricts Bash to read-only git at runtime still
needs a live session to confirm (kept as the verify item). Tests: 1018 pass,
`tsc --noEmit` clean.

## Adversarial findings — round 2 (fresh read of the real diff)

**adversarial: findings**

Reviewed the actual `git diff` + new files, not the report. Re-verified locally:
`npx tsc --noEmit` → exit 0; the 6 touched test files → 130/130 pass. The
phase works on the happy path. What follows is what survives that.

- **[should-know] The "silent-drop" bug the round-1 fix claimed to kill still
  lives on the broken-report branch.** `src/prompts/sessionContext.ts:480-483`
  (`bodyBlock`) + `:498-499` (`reportWrite`), fed by
  `src/commands/adversarialContext.ts:44-49`. Round 1 only patched the
  `reportExists === false` case. But when the report **exists yet is unparseable**
  (malformed YAML, truncated `do` write), `readReportVerify`
  (`verifyContext.ts:33-38`) swallows the `RunReportParseError` and returns
  `body: undefined` — so `buildAdversarialContext` calls the builder with
  `reportExists: true, reportBody: undefined`. In the builder that hits the
  `: reportExists ? ''` arm (no implementation-report context) **and** the
  `reportWrite = reportExists ? "Edit … add a section at the end"` arm. Net: the
  reviewer is told to `Edit`-append findings to a file that `parseRunReport` will
  keep rejecting, so on the next `done`/`verify`/`adversarial` those findings are
  read back as `body: undefined` and **silently dropped from the workflow** —
  exactly the failure mode round 1 said it eliminated, just reached via a corrupt
  report instead of a missing one. Edge (normal `do` writes valid YAML), and it's
  shared with `verify`, but the round-1 narrative specifically claimed this class
  was fixed; it's only half-fixed. Minimum: branch on "have a parseable report",
  not on "a file exists" — i.e. treat `reportExists && body===undefined` like the
  no-report fail-loud path.

- **[should-know] New code introduces fresh Czech JSDoc + inline comments, which
  the project's own CLAUDE.md forbids for new code.**
  `src/prompts/sessionContext.ts:445-455` (the `AdversarialSessionInput`
  doc-comments: "Je fáze už uzavřená…", "Volný text reportu…", "Existuje run
  report…") and `:457-464`, `:474-478`, `:488-492` (inline block comments, all
  Czech). CLAUDE.md states plainly: write in English "comments and JSDoc in the
  code" and "Whenever you come across Czech text in the program, translate it."
  The sibling `adversarialContext.ts` added in the same phase is fully English, so
  this is inconsistent *within one phase*, not just legacy drift. Doesn't break
  runtime; it's a documented-rule violation that no test can catch. (The new
  `sessionContext.test.ts` / `adversarial`-prompt test descriptions are Czech too,
  but there `verify` precedent is identical, so weaker.)

- **[nit] Re-running adversarial duplicates the findings section and re-feeds old
  findings as "implementation report".** `adversarialContext.ts:47-48` →
  `sessionContext.ts:480-481`. `readReportVerify` returns the *whole* report body,
  which after a first pass already contains an `## Adversarial findings` section;
  the builder embeds that entire body under `# Implementation report` and then the
  `reportWrite` text tells the reviewer to append *another* `## Adversarial
  findings` at the end. This very file is the proof — it already carries three
  such sections. Harmless (no crash, parser ignores body), but the report grows a
  stack of duplicated/recursive findings and the second reviewer reads the first
  reviewer's verdicts as if they were the implementation log.

- **[nit] The no-phase guard message lies when the phase file is missing/corrupt.**
  `adversarialContext.ts:28-41`. `loadPhase` → `readPhaseFile`
  (`store.ts:178-185`) swallows *every* error (ENOENT and malformed JSON alike)
  and returns `null`. So if `currentPhaseId` is set but `.mini/phases/phase-N.json`
  is unreadable, the code falls through to `log.error('No phase to red-team
  (neither a current nor a closed phase).')` — which is false; there *is* a
  current phase, its file just rotted. The user is steered to `/mini:next`
  instead of to the real problem. Pre-existing and shared with `verify`, not
  introduced here, but the adversarial path inherits it.

- **[nit] Failure branches of `mini adversarial` are untested (parity gap with the
  precedent it copied).** `src/commands/adversarial.test.ts` covers no-project /
  no-phase / current-phase tool-set / last-done — but not `confirm:false`
  (cancel), not `workWithClaude` throwing (`adversarial.ts:75-78`), not a non-zero
  `exitCode` (`:83-85`). `verify.test.ts` doesn't cover them either, so this is
  parity, not regression — but given CLAUDE.md's emphasis on testing failure
  paths, copying verify's blind spots forward leaves the cancel/error/non-zero
  branches unverified in both.

### Checked and found clean
- `--allowed-tools` wiring: `work.ts:28-29` joins the array with `,`; none of the
  adversarial tokens contain a comma, so `Bash(git diff:*)` / `Bash(git log:*)` /
  `Bash(git show:*)` reach the CLI intact. `adversarial.test.ts:102-111` pins the
  exact array, so a typo'd scope token can't ship silently. (Whether the CLI
  *enforces* the scoping at runtime is still the open live-session item — agreed.)
- The three-way `bodyBlock`/`reportWrite` branching is self-consistent for the two
  *normal* states (parseable report present; no report at all) — the round-1 fail-
  loud no-report path is correct and tested. Only the corrupt-report sub-case
  (finding #1) slips through.
- No-project / no-phase exits are graceful and tested: `adversarial.ts:36-46`,
  `context.ts:77-80` (`process.exitCode = 1`, empty stdout — covered).
- Memory-write block renders only for `phaseDone` and the "not yet closed" frame
  omits `.mini/memory/…` — covered by `sessionContext.test.ts`.
- Slash-command frontmatter carries no `allowed-tools`, same as every other
  command; the inline `/mini:adversarial` therefore prompts for Bash like the rest
  — consistent, not a new hole. Independence caveat + both escape hatches are
  present and test-pinned (`commands.test.ts`).

## Adversarial findings — resolution (round 2)
Triaged with the user; scope agreed = the two should-knows + the cheap test gap.

- **[should-know] R2-#1 corrupt-report silent drop — FIXED.** Round 1 only handled
  the *missing* report. The builder now takes a three-state `reportStatus`
  (`valid` / `corrupt` / `missing`) instead of a boolean `reportExists`.
  `adversarialContext.ts` derives it from the tolerant `readRunReportSummary`
  (null = missing, `unparseable` = corrupt — independent of step matching). Only a
  `valid` report gets an `Edit`-append; `corrupt`/`missing` fail loud into the chat
  and point at `/mini:do`. New tests: corrupt-prompt case
  (`sessionContext.test.ts`) and corrupt-report routing (`context.test.ts`).
- **[should-know] R2-#2 Czech JSDoc/comments in new code — FIXED.** Translated the
  `AdversarialSessionInput` doc-comments, the function JSDoc and the inline block
  comments in `buildAdversarialSessionPrompt` to English (the rule in CLAUDE.md).
  Test *descriptions* left Czech to match the rest of `sessionContext.test.ts` /
  the verify precedent (consistency within the file).
- **[nit] R2-#5 untested failure branches — FIXED.** Added cancel (`confirm:false`
  → no Claude started), `workWithClaude` throwing (→ `claude-error`), and non-zero
  exit (→ still `ok`, just warns) to `adversarial.test.ts`.

Deferred to the backlog (`mini todo`), agreed with the user:
- R2-#3 re-run duplicates the findings section / re-feeds old findings as the
  implementation report (needs body-section stripping).
- R2-#4 `loadPhase` swallows all errors → misleading "no phase" message on a
  corrupt phase file (pre-existing, in `store.ts`, shared with verify).
- Apply the same three-state report handling to `mini:verify` (it still has the
  R2-#1 class of bug).

Tests after round 2: 1023 pass, `tsc --noEmit` clean.

## Adversarial findings — round 3 (fresh read of the real diff)

**adversarial: findings**

Independence caveat: this ran **inline via `/mini:adversarial`**, so it shares the
author's context — treat it as a same-author sanity pass, not a truly independent
red-team. Re-verified locally before writing: `npx tsc --noEmit` → exit 0; the 4
touched test files (`adversarial`, `context`, `sessionContext`, `commands`) →
108/108 pass. The phase works on the happy path. What follows survives that.

- **[should-know] The round-2 "three-state status" fix uses a *more lenient*
  parser than the gate it protects, so the silent-drop class is still reachable
  through the middle band.** `src/commands/adversarialContext.ts:50-60` decides
  `valid`/`corrupt`/`missing` from `readRunReportSummary` →
  `summarizeRunReportText` (`src/state/runReport.ts:314-337`), whose *only*
  structural test is the front-matter regex `^---\n…\n---\n` — it ignores
  `phase`/`verdict`/`steps` entirely (verdict just becomes `null`). But the gate
  that actually consumes the body downstream is the **strict** `parseRunReport`
  (`runReport.ts:134-221`), used by `verify` via `readReportVerify`
  (`verifyContext.ts:27`) and by `mini done` (`done.ts:552`). It throws on a
  non-matching `phase`, a missing/invalid `verdict`, or **step titles that don't
  match the phase's current steps** (`runReport.ts:209,216`). So a report with
  intact `---` delimiters but strict-invalid content is bucketed **`valid`**, and
  the prompt tells the reviewer "`Edit`-append your findings, it won't disturb
  `mini done`". It will: the next `verify` runs `parseRunReport` → throws →
  `readReportVerify` swallows it → `body: undefined` → the appended adversarial
  findings are **silently dropped from the verify context** — exactly the failure
  mode rounds 1-2 claimed to have closed, just reached via a *partially* corrupt
  report instead of a header-less one. The `corrupt` bucket only ever catches
  reports the lenient regex itself can't match (no `---` at all); everything
  between that and fully-strict-valid is misclassified.
  - **Reachable in normal flow, not just by hand-editing:** run `/mini:do`
    (writes a strict-valid report with the then-current step titles), then
    `/mini:plan` again and rename/reorder a step. The report's `steps[].title`
    no longer matches `phase.steps`, so `parseRunReport` throws "Report uvádí
    kroky, které neexistují", while `summarizeRunReportText` still returns
    `unparseable: false`. Verified the divergence directly: a report
    `---\nphase:1\nverdict:done\nsteps:\n  - title: renamed step\n …\n---\nbody`
    → tolerant parser `unparseable=false` (→ `valid`), strict parser rejects.
  - This is *introduced/amplified by this phase by design*: the comment at
    `adversarialContext.ts:22-23` deliberately picks the tolerant summary
    "independent of step matching", but the gate the findings flow toward is
    step-matched. `verify` itself is self-consistent (it both detects and reads
    with the strict parser), so it doesn't have this particular write-then-drop
    inconsistency — adversarial is the one that decides "safe to write" with a
    different, weaker check than the reader.
  - Minimum fix: classify with the **same** strictness the downstream reader
    uses — try `parseRunReport` (or a check that mirrors its phase/verdict/steps
    validation) and treat a throw as `corrupt`, so "valid" really means "the gate
    will accept it". Note the deferred backlog item "apply three-state to
    `verify`" does **not** cover this — it's a parser-strictness mismatch, not a
    missing three-state branch.

### Checked and found clean (or confirmed already-known)
- **`reportStatus` mapping itself is correct** for the three buckets it can tell
  apart: `summary === null` → `missing`, `summary.unparseable` → `corrupt`, else
  `valid` with `body` only set when non-empty (`adversarialContext.ts:53-60`).
  A valid report with no free text → `valid` + `reportBody: undefined` → the
  builder's `reportStatus === 'valid' ? ''` arm (`sessionContext.ts:480-483`),
  no contradiction. Covered by the valid/corrupt/missing tests.
- **Scoped-Bash tokens reach `workWithClaude` intact and are pinned.**
  `adversarial.test.ts:107-116` asserts the exact array incl. `Bash(git diff:*)`/
  `Bash(git log:*)`/`Bash(git show:*)`; `work.ts` joins with `,` and no token
  contains a comma. (Whether the CLI *enforces* the scope at runtime is still the
  open live-session item — agreed, not re-checkable here.)
- **Failure branches now covered**, closing the round-2 gap: no-project,
  no-phase, cancel (`confirm:false` → Claude not started), `workWithClaude`
  throwing (→ `claude-error`), non-zero exit (→ still `ok`, warns). Good.
- **Closed-phase fallback**: `currentPhaseId === null` → last `done` phase, newest
  first (`[...phases].reverse().find`), tested ("Last closed phase", not "Old
  phase"). For a closed phase `git diff` is empty and the reviewer must use
  `git log`/`git show`; the prompt mentions both and the tool scope allows them.
- **Czech-comment rule (R2-#2)**: re-grepped the new/changed source — the
  `AdversarialSessionInput` JSDoc, function JSDoc and inline comments in
  `sessionContext.ts` and all of `adversarialContext.ts`/`adversarial.ts` are
  English. Fix held.

### Confirmed still-open (already on the backlog, not re-litigated)
- R2-#3 re-running adversarial duplicates the `## Adversarial findings` section
  and re-feeds prior findings as the "implementation report" (this very file,
  now four such sections, is the proof). Harmless to the parser; noisy.
- R2-#4 `loadPhase`→`readPhaseFile` swallows *all* errors (ENOENT and malformed
  JSON alike) → on a corrupt `phase-N.json` with `currentPhaseId` set, the user
  is told "No phase to red-team" and steered to `/mini:next` instead of to the
  real problem. Pre-existing, shared with `verify`.
