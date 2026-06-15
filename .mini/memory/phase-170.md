# Phase 170 — Standalone mini security command

**Goal:** Add a 'mini security' command that opens an interactive review session built by buildSecurityReviewContext over the last phase (default when no range flags are given) or a range (--from-phase/--to-phase, --from/--to), derives the .mini/security/<range>.md output path from the range, and runs with a scoped tool set — mirroring adversarialProject.ts. Open decision for discuss: how the reviewer is permitted to write the .md report (a Write tool scoped to .mini/security/ vs a scoped CLI write like 'mini findings add'); the latter would mean revising the phase-169 prompt. Verify Claude Code permission scoping via Context7 rather than guessing, and confirm the single-last-phase default passes through the genesis fallback for a first phase without preSha.

## Steps
- [done] Resolve security target: range input + output path
- [done] mini security command + scoped tool set
- [done] Pinning test for SECURITY_ALLOWED_TOOLS
- [done] Register mini security in CLI
- [done] Command behavior test

## Auto-commit
- Phase 170: Standalone mini security command

## Discussion
# Phase 170 — Standalone mini security command

## Intent
Add a `mini security` CLI command — the security-review twin of `mini adversarial-project`.
It opens an interactive Claude Code session whose first message is built by
`buildSecurityReviewContext` (phase 169). It reviews either:
- a **range of phases** via `--from-phase/--to-phase` or git refs `--from/--to`, or
- the **last `done` phase** by default when no range flags are given.

The command derives the report output path from the range, passes it as the
`outputPath` arg to `buildSecurityReviewContext`, and runs `workWithClaude` with a
scoped tool set. Structure mirrors `adversarialProject.ts` (no-project guard,
print prompt, confirm, run, status). This is the CLI wiring only — the prompt and
the context builder already exist.

## Key decisions
- **Report write mechanism: Write tool, scoped to `.mini/security/`** (e.g.
  allowed tool `Write(.mini/security/**)`). This keeps the phase-169 contract
  intact — the reviewer writes the `.md` report itself and does NOT call
  `mini findings add`. The CLI-write alternative was rejected: it would force a
  rewrite of the phase-169 prompt and merge security into the findings store,
  which 169 deliberately kept separate.
- **Output path naming:**
  - phase mode → `.mini/security/range-<A>-<B>.md` (matches existing
    `range-1-25.md`);
  - single last-phase default → `.mini/security/phase-<N>.md` (NOT `range-N-N.md`);
  - ref mode (`--from/--to`), where refs are not filename-safe → use resolved
    **short SHAs**: `.mini/security/range-<shortFrom>-<shortTo>.md`.
- **Default selection: the last `done` phase** (not `currentPhaseId`). Diverges
  from `adversarialContext.ts` on purpose — security review runs after a phase is
  committed; an in-progress current phase has no `preSha` and would hard-fail in
  `resolveRange`. Build `RangeInput{ fromPhase: id, toPhase: id }` and let
  `resolveRange` (phase mode) resolve it.
- **Scoped tool set**: mirror `ADVERSARIAL_PROJECT_ALLOWED_TOOLS` (Read, Grep,
  Glob, LS, read-only git: `git diff/log/show`) but **swap** `Bash(mini findings
  add:*)` for `Write(.mini/security/**)`. Keep it as its own constant so its
  pinning test fails independently.

## Watch out for
- **Verify the scoping for real, don't trust docs.** Context7 confirms path-pattern
  permission rules exist and the code already passes scoped patterns via
  `--allowed-tools` (`Bash(git diff:*)`). Still test that the CLI flag accepts
  `Write(.mini/security/**)`, and note: `work.ts` does NOT set `--permission-mode`,
  so a Write OUTSIDE the pattern **prompts the human** (it is not a hard block, and
  not a silent fail). That ask is the safety net against prompt-injection from the
  untrusted diff steering a write elsewhere. Unknown whether the matcher normalizes
  `..` — assume not and rely on the ask.
- **Genesis fallback for the single-phase default**: for a first-and-only phase
  without `preSha`, `resolveRange` resolves `fromSha`=git empty-tree,
  `toSha`=HEAD (confirmed in `range.ts:101-123`). Works automatically through the
  `fromPhase==toPhase==firstId` path. No special-casing needed in the command.
- **Silent overwrite on re-run**: same range → Write overwrites the prior `.md`.
  In ref mode, two different reviews with colliding 7-char short SHAs would also
  overwrite. Acceptable but worth a note / consider whether to warn.
- **`.mini/security/` directory**: already exists (holds `range-1-25.md`); the
  Write should still tolerate creating it if absent.
- **Out of scope (do not add)**: a `/mini:security` slash command mirror is a
  separate concern (like the phase-166 slash command was) — the goal here is the
  CLI command only. Register `mini security` in the CLI router.

## Run report
---
phase: 170
verdict: done
steps:
  - title: "Resolve security target: range input + output path"
    status: done
  - title: "mini security command + scoped tool set"
    status: done
  - title: "Pinning test for SECURITY_ALLOWED_TOOLS"
    status: done
  - title: "Register mini security in CLI"
    status: done
  - title: "Command behavior test"
    status: done
verify:
  - title: "Live Claude permission scoping of Write(.mini/security/**)"
    detail: "I verified mechanically that SECURITY_ALLOWED_TOOLS reaches workWithClaude's --allowed-tools and that the command builds the prompt + cancels cleanly. I did NOT run a live Claude session, so I could not observe that the CLI actually accepts the Write(.mini/security/**) scope, that a write inside the dir is pre-approved, and that a write OUTSIDE it prompts the human (rather than silently failing). work.ts sets no --permission-mode, so the guarantee is 'default deny -> ask', not a hard block. Worth one real run during /mini:verify."
---

# Phase 170 — report from the auto session

## What was built
- `src/commands/securityTarget.ts` — `resolveSecurityTarget(cwd, input)` maps CLI
  input to `{ input, outputPath }`: default (no flags) → last `done` phase →
  `phase-<id>.md`; phase flags → `range-<A>-<B>.md`; ref flags → resolved short
  SHAs → `range-<short>-<short>.md`. Range validity is delegated to `resolveRange`
  (the single source of truth) — not re-implemented.
- `src/commands/security.ts` — the `mini security` command, mirroring
  `adversarialProject.ts` (no-project guard, build prompt, confirm, run, status).
  Scoped tool set `SECURITY_ALLOWED_TOOLS` swaps `Bash(mini findings add:*)` for
  `Write(.mini/security/**)`; no `Edit`. Hint points at the report path.
- CLI registration of `mini security` with `--from-phase/--to-phase` / `--from/--to`.
- Tests: `securityTarget.test.ts` (all 3 modes + genesis + no-done + invalid ref +
  mixed flags + the uncommitted-next case), `securityAllowedTools.test.ts`
  (standalone pinning), `security.test.ts` (command wiring: outputPath threaded to
  the builder, scoped tools to workWithClaude, null/cancel → no session).
- Full suite green (1175 tests), typecheck + build clean. Error paths and the
  default path smoke-tested against the real repo.

## Real bug found and fixed on the unhappy path
The first real-repo run of the default (`mini security`, no flags) **failed**:

    [x] Phase 170 has no recorded pre-commit SHA; cannot resolve range end.

Cause: the last `done` phase is 169, but `resolveRange` phase mode computes the
range END as the **next** phase's `preSha` (170) — and 170 is the in-progress
phase with no `preSha`. So defaulting to the last done phase would hard-fail
**every time the next phase is in progress**, which is the normal state when you
review the phase you just finished.

Fix (kept local to the security resolver, `range.ts` untouched): the default now
ends at **HEAD** — the last done phase's own commit is HEAD, so HEAD is the
correct, robust end. A first phase without `preSha` still delegates to phase mode
so the genesis (empty-tree) start keeps working. The discussion only anticipated
the *start* (genesis) edge; this *end* edge was missed in discuss and plan.

## Residual limitation (documented, narrow)
The genesis default — the project's **first** phase, no `preSha`, AND a next phase
already existing but uncommitted — still errors, because `emptyTree..HEAD` can't
be expressed as a git-ref range and phase mode anchors the end on the missing
next-phase `preSha`. This is rare (only a brand-new project mid-second-phase) and
the error is clear, not silently wrong. Fixing it fully would mean changing the
shared `range.ts` end-resolution (which also feeds adversarial-project) or the
phase-169 builder signature — both out of scope here.

## Decision worth recording
I chose to fix the end-of-range behaviour **locally in the security default**
(end at HEAD) rather than change `resolveRange`'s shared `toSha` fallback, to avoid
silently altering `mini adversarial-project`. That is a real crossroads — consider
running `/mini:decision` before `/mini:done` to capture the why.
