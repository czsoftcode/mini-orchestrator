# Phase 169 — Security review context builder

**Goal:** Build a range-scoped security-review context/prompt builder (reusing resolveRange; handles both a single last phase and a range) with our own MIT-clean prompt informed only by OWASP/CWE categories and its own separate output target; no CLI dispatch, no slash command, no auto-chaining onto adversarial yet. On an empty/unresolvable range or ref mode that does not map to phase boundaries it returns null (mirroring buildProjectAdversarialContext), never throws.

## Steps
- [done] Security prompt builder in sessionContext
- [done] Snapshot test for the security prompt
- [done] Context assembler buildSecurityReviewContext
- [done] Unhappy-path test for the assembler
- [done] Typecheck + green test suite

## Auto-commit
- Phase 169: Security review context builder

## Discussion
# Phase 169 — Security review context builder

## Intent
First slice of the mini-native security review feature (backlog idea 13). Build
ONLY the pure builder: a `string | null` prompt/context assembler for a
security review over a phase range, mirroring `buildProjectAdversarialContext`
(`src/commands/adversarialProjectContext.ts`) +
`buildProjectAdversarialSessionPrompt` (`src/prompts/sessionContext.ts`), with a
security lens instead of a correctness lens. NO CLI dispatch, NO slash command,
NO auto-chaining onto adversarial, NO file writing — those are separate later
phases (already queued in `mini todo`).

Reuse `resolveRange` (`src/range.ts`) unchanged. On an empty/unresolvable range,
or ref mode that doesn't map to phase boundaries, return `null` (log the reason)
exactly like `buildProjectAdversarialContext` — never throw.

## Key decisions
- **Output = separate markdown report**, NOT the findings store. The prompt tells
  the reviewer to write a durable report at `.mini/security/<range>.md`. Chosen
  over `mini findings add --source security` deliberately: matches the existing
  precedent file `.mini/security/range-1-25.md` and idea 13/14 ("security stays a
  separate output by design"). Consequence the user accepted: security findings
  do NOT surface in `mini next`'s "Open review findings" — a visible reminder is
  the job of the later auto-chain phase, not this one. `FindingSource` is NOT
  touched (no `security` value added).
- **Reviewer writes the `.md` directly.** Unlike adversarial-project (where the
  reviewer never writes a file, only calls `mini findings add`), here the prompt
  instructs the reviewer to write `.mini/security/<range>.md` itself, following
  the structure of the precedent. (Trade-off: no CLI validation of path/format;
  if a later phase moves to a CLI-owned store, the prompt contract changes.)
- **Builder stays pure / no I/O.** The output path and the `<range>` token are
  passed INTO the builder as input (the future CLI computes them); the builder
  only interpolates them into the prompt string. So the builder's input is
  roughly: `projectMd`, `fromSha`, `toSha`, `phases` (id+title, like
  `AdversarialProjectPhase`), and the resolved `outputPath` (e.g.
  `.mini/security/range-1-25.md`).
- **"Single last phase" is the CLI's job, not the builder's.** The builder takes
  a `RangeInput`; a single phase is just `from == to`. Computing "the last
  phase" (current phase id) belongs to the later CLI phase. Do NOT bake a
  current-phase lookup into the pure builder.
- **Prompt content (our own words, MIT-clean):** bake in a short project threat
  model — local developer CLI, the only realistically untrusted input is the
  git-shared `.mini/` from a cloned/pulled repo, no network listener, no auth, no
  secret storage — plus an OWASP/CWE-category lens. Do NOT copy Anthropic's
  `/security-review` or the Apache-2.0 `security-auditor.md` verbatim.
- **Report structure to instruct** (mirror the precedent
  `.mini/security/range-1-25.md`): a `# Security review — <range>` header, the
  resolved `git diff <fromSha>..<toSha>` line, Threat model, Verdict, Findings as
  `### SEC-N · <severity> · <title>` using the same severities as findings
  (`blocker | should-know | nit`), and a "Checked and clean" section. The
  reviewer reads the real diff (thin index, same as adversarial-project), not the
  phase titles.

## Watch out for
- Keep the slice small: builder + a snapshot test of the prompt. Do NOT add CLI,
  slash command, auto-chain, doctor/help wiring, or filename-derivation logic —
  those are separate todos.
- The builder must NOT write any file (the reviewer does). The builder is pure;
  the assembler reads `project.md` (tolerating its absence, like
  `readProjectSafe`) and resolves the range — nothing else.
- Don't add a `security` value to `FindingSource` / `findingsStore` — output is a
  standalone `.md`, not the findings store.
- Snapshot test will pin the prompt — write the security prompt deliberately
  (threat model + OWASP/CWE lens) before snapshotting, since later edits churn
  the snapshot.
- Unhappy path parity with `buildProjectAdversarialContext`: empty range,
  inverted range, missing `preSha`, ref mode with no phase mapping → `null` +
  logged reason, never an exception.

## Run report
---
phase: 169
verdict: done
steps:
  - title: "Security prompt builder in sessionContext"
    status: done
  - title: "Snapshot test for the security prompt"
    status: done
  - title: "Context assembler buildSecurityReviewContext"
    status: done
  - title: "Unhappy-path test for the assembler"
    status: done
  - title: "Typecheck + green test suite"
    status: done
---

# Phase 169 — report from the auto session

First slice of the mini-native security review feature (backlog idea 13): only the
**pure builder**, no CLI / slash / doctor / auto-chain wiring (those are queued in
`mini todo`).

## What was built
- `buildSecurityReviewSessionPrompt(input)` + `SecurityReviewInput` in
  `src/prompts/sessionContext.ts` — a pure prompt builder mirroring
  `buildProjectAdversarialSessionPrompt`, but with a security lens: a baked-in
  project threat model (local CLI, untrusted git-shared `.mini/`, no
  network/auth/secrets), an OWASP/CWE checklist used only for *reachable* sinks,
  and the report structure from the precedent `.mini/security/range-1-25.md`
  (Range / Threat model / Verdict / `SEC-N · <severity>` findings / Checked-and-clean).
- `buildSecurityReviewContext(cwd, input, outputPath)` in the new
  `src/commands/securityReviewContext.ts` — assembler mirroring
  `buildProjectAdversarialContext`: resolves the range via the unchanged
  `resolveRange`, reads `project.md` tolerantly, reuses `resolveRangePhases` from
  `adversarialProjectContext.ts`, returns the prompt or `null` (logged) on range
  failure.
- Tests: a `buildSecurityReviewSessionPrompt` block in
  `src/prompts/sessionContext.test.ts` and a new
  `src/commands/securityReviewContext.test.ts`.

## Decisions honoured from the discussion
- **Output = separate `.md` report**, written by the reviewer directly. The prompt
  explicitly does **not** route to `mini findings add` (security stays a separate
  output). `FindingSource`/`findingsStore` were not touched.
- **Builder stays pure**: `outputPath` and the `<range>` token are *inputs*; no
  filename-derivation, no file writes, no CLI dispatch here.
- **"Single last phase" is the CLI's job**: the builder just takes a `RangeInput`
  (single = `from == to`).
- Prompt is **our own wording (MIT-clean)** — not derived from Anthropic's
  `/security-review` or the Apache-2.0 `security-auditor.md`.

## Test style note
`sessionContext.test.ts` does not use vitest snapshots; its sibling
`buildProjectAdversarialSessionPrompt` pins the prompt with targeted `toContain`
assertions. I matched that house style instead of introducing a `.toMatchSnapshot`
file, so the "snapshot test" step is realised as targeted wording assertions
(threat model, OWASP/CWE, output path, SEC-N severity vocabulary, both phase- and
ref-mode).

## Verification (all mechanical, done here)
- `npm run typecheck` — clean.
- `npm test` — 84 files / 1158 tests pass.
- Scope check: only `sessionContext.ts(+test)` and the two new
  `securityReviewContext.*` files changed; `findingsStore.ts` untouched; a grep
  confirms the new functions are **not** wired into any CLI/slash/doctor command
  yet (as intended).

## Watch out for (next phases)
- The reviewer is told to write `.mini/security/<range>.md` itself. The future CLI
  phase must grant it a **Write tool scoped to `.mini/security/`** and compute the
  actual `outputPath` (filename from the range), neither of which exists yet.
- Because security findings live in a standalone report (not the findings store),
  they will **not** surface in `mini next` — the planned auto-chain phase owns the
  visible reminder.
