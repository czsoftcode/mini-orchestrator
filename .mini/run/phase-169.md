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
