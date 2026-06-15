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
