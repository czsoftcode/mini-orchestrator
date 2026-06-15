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
