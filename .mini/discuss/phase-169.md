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
