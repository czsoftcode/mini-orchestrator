# Phase 172 — Document the security command

**Goal:** Write docs/interactive/security.md and docs/non-interactive/security.md mirroring the adversarial-project docs (range rules, no-flags = last completed phase, the .mini/security/<range>.md report output, and the inline-not-scoped caveat), and add a Security review row to the Review table in docs/README.md.

## Steps
- [done] CLI page docs/non-interactive/security.md
- [done] Slash page docs/interactive/security.md
- [done] Security review row in docs/README.md
- [done] Accuracy + link verification

## Auto-commit
- Phase 172: Document the security command

## Run report
---
phase: 172
verdict: done
steps:
  - title: "CLI page docs/non-interactive/security.md"
    status: done
  - title: "Slash page docs/interactive/security.md"
    status: done
  - title: "Security review row in docs/README.md"
    status: done
  - title: "Accuracy + link verification"
    status: done
verify:
  - title: "Read the two new docs pages for tone/clarity"
    detail: "docs/interactive/security.md and docs/non-interactive/security.md — content is mechanically verified (links resolve, caveats match code), but the prose readability is a human call."
---

# Phase 172 — report from the auto session

## What was done

Documented the security review command, following the existing
`adversarial-project` docs pattern.

- **`docs/non-interactive/security.md`** — the CLI reference: synopsis (no-flags +
  phase/ref forms), a "what is reviewed" table, a report-path table
  (`phase-<id>` / `range-<A>-<B>` / `range-<short>-<short>`), the scoped tool set
  (read + read-only git + `Write(.mini/security/**)`, no `Edit`, no findings
  write), the genesis fallback, and the phase-mode range-end caveat.
- **`docs/interactive/security.md`** — the slash-command page: what it does,
  In-a-session steps passing `$ARGUMENTS` to `mini context security`, an example,
  and the prominent caveat that an **inline run does not enforce the scoped tool
  set** (only the terminal `mini security` does).
- **`docs/README.md`** — added a "Security review of a phase or range" row to the
  Review table and adjusted the section blurb (security writes its own report, it
  does not land in the findings store).

## Scope note (what was already done, not redone here)

Backlog item [19] also listed "COMMAND_DEFS entry", "`mini --help` entry" and
"`mini doctor` recognises/counts the command". Those were already delivered by
phases 170 (`mini security` CLI command + `--help` description) and 171
(`COMMAND_DEFS` entry + `mini context security` description); `doctor` counts via
`COMMAND_DEFS.length`, so the new command is included automatically. This phase
deliberately covered only the genuinely missing piece — the docs — rather than
re-touching already-shipped work.

## Verification (done mechanically, not by eye)

- **Links:** extracted every relative `.md` link target from both new pages and
  `docs/README.md` and resolved each against the filesystem — **no broken links**.
  Confirmed the extraction was non-vacuous (targets were actually found).
- **Caveat: inline ≠ scoped.** Verified in code: `SECURITY_ALLOWED_TOOLS` is
  passed only by `security.ts` via `workWithClaude`; the `mini context security`
  route (`context.ts`) calls `buildSecurityContext` and keeps only the prompt — it
  passes no `allowedTools`. So an inline slash run genuinely runs unscoped.
- **Caveat: no-flags skips in-progress.** `resolveSecurityTarget` →
  `lastDonePhaseId` finds the last `status === 'done'` phase, so an in-progress
  phase is skipped.
- **Caveat: phase-mode range end needs the next phase's `preSha`.** Confirmed
  empirically in phase 171 (`--from-phase 169 --to-phase 170` fails because the
  current phase 171 has no `preSha`), and `adversarial-project` behaves
  identically.

No code changed, so no typecheck/test run was needed; the test suite was green at
the end of phase 171 and this phase touches only Markdown under `docs/`.

## For the human

Worth a quick read of the two pages for tone — the facts are checked, the prose
isn't. One small editorial choice: I trimmed the Review-section blurb in
`docs/README.md` from "Findings land in the durable store" to distinguish the
correctness pass (store) from the security pass (own report), since the old
wording would now be wrong for the security row.
