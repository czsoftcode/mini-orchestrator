# Security review — ae4c3c9..06f54f4

- **Range:** `git diff ae4c3c9f5e06f74fdeed5e3d03414425a656a18f..06f54f441807ccd63ad65fb178d763ca2be4464e`
- **Reviewed at:** HEAD `06f54f4` (mini-orchestrator v1.21.3)
- **Method:** Targeted security-sink pass, not a line-by-line correctness audit.
  The range is a single commit (Phase 170) adding the standalone `mini security`
  command. I traced every untrusted input (CLI flags, git-shared `.mini/state.json`,
  the diff/`.mini/` content that lands in the prompt) to its sinks: the `claude`
  process spawn, the report-path construction, the file reads behind
  `loadPhase`/`loadHeader`, and the prompt assembled for the review session. The
  git helpers (`resolveRange`, `runGit`, `verifyRef`) are pre-existing and outside
  this range, so I only confirmed how the new code calls them.
- **Threat model:** `mini` is a local developer CLI with no network surface. The
  attacker here owns a cloned/pulled repo and controls `.mini/` (`state.json`,
  `project.md`, phase titles/goals) plus the working tree and git history; the
  developer also supplies `--from/--to/--from-phase/--to-phase`. The new command
  spawns `claude` for an interactive review session and tells it to write a
  Markdown report. Relevant categories: argument injection into the spawn, path
  traversal in the report path, unsafe parsing of `state.json`, and
  prompt-injection via the assembled context.

## Verdict
No blockers. The spawn and the tool sandbox are sound. One should-know
(unvalidated `state.json` phase id reaches a filesystem path) and one nit
(prompt-injection bounded by the read-only tool set) worth recording.

## Findings

### SEC-1 · should-know · Unvalidated `state.json` phase id flows into the report path
**Where:** `src/commands/securityTarget.ts:96` (`outputPath: securityReportPath(\`phase-${id}\`)`),
via `lastDonePhaseId` at `securityTarget.ts:41-44`; sink `securityReportPath` at
`securityTarget.ts:118-120`.

In the default (no-flag) path, `id` is `lastDone.id` taken straight from
`loadHeader`, which does `JSON.parse(raw) as StateHeader` with **no schema
validation** (`src/state/store.ts:207-214`) — a bare cast. A poisoned
`.mini/state.json` can therefore set the last `done` phase's `id` to a string
such as `X/../../../../etc/x`. That value is then string-interpolated twice with
no sanitization:

1. into the **read** path of `loadPhase(cwd, id)` → `phaseStem`/`phaseFileName`
   do `String(id).padStart(3,'0')` (`src/state/store.ts:60-67`), so the code
   reads `.mini/phases/phase-<id>.json` — a path-traversal read; and
2. into the **report output path** `join('.mini','security', \`phase-${id}.md\`)`,
   which `path.join` normalizes, so `..` segments escape `.mini/security/`.

Why it is only should-know, not a blocker:
- Reaching the traversal **output** path requires `loadPhase` to first return an
  object with a valid `autoCommit.preSha` (else the code falls to the phase-mode
  branch and `resolveRange` errors out, returning `null`). Because the read path
  carries the *same* traversal, planting that preSha file generally means a file
  the attacker cannot commit outside the repo — the `phase-` prefix is glued to
  the first segment, so the first `..` cannot act as a parent jump. Exploitability
  is contrived.
- Even if a traversal `outputPath` is produced, it only flows into the **prompt
  text** and a log hint. The actual write is gated by the fixed allow-list
  `Write(.mini/security/**)` (`security.ts:38`), which a normalized traversal path
  will not match, so Claude must **ask the human** before writing there. The
  read in (1) only attempts `JSON.parse` and extracts `preSha`; a failed read is
  caught and yields `null`, with no content leaked.

Direction (do not change here): validate header phase ids as positive integers
when loading `state.json` (the CLI already does this for `--from-phase/--to-phase`
via `parsePhaseNumber`, but trusts the on-disk ids). This is a systemic trust of
`state.json` ids across `mini`, not unique to this range; the range is what newly
routes that id into an out-of-repo *file path* embedded in a prompt.

### SEC-2 · nit · Prompt-injection via `.mini/` content, bounded by the tool sandbox
**Where:** `src/commands/securityReviewContext.ts:49-58` →
`buildSecurityReviewSessionPrompt` (`src/prompts/sessionContext.ts:749,831,880`).

The review prompt embeds attacker-controlled `.mini/project.md` and phase
titles/goals (from `state.json`), and the reviewer is told to read the diff of a
repo the attacker shaped. Injected instructions in that content could try to
steer the session. This is inherent to an agent reviewing untrusted material;
recorded as a nit because the blast radius is tight:
- the session runs **without** `--permission-mode`/`acceptEdits` (`security.ts:73-76`,
  `workWithClaude` only passes `--allowed-tools`), so anything outside the
  pre-approved set prompts the human;
- the pre-approved set is read + search + **read-only** git + a single scoped
  `Write(.mini/security/**)` — no `Edit`, no arbitrary `Bash`, no network;
- `mini security` prints the full first message and requires an explicit confirm
  before starting (`security.ts:51-66`).

Residual risk: within the sandbox an injection could still make the reviewer read
a sensitive in-repo file and copy its contents into the report it writes (which
the developer may then commit). The human is the only checkpoint on that. No code
change recommended; noted for awareness.

## Checked and clean
- **Process execution** — `workWithClaude` (`src/claude/work.ts:24-58`) uses
  `spawn('claude', args)` with **no `shell: true`**; the prompt is passed as a
  separate argv element after `--`, and `--allowed-tools` receives a comma-joined
  **constant** (`SECURITY_ALLOWED_TOOLS`), never untrusted data. No shell
  interpolation, no argument injection into the spawn.
- **Allowed-tools allow-list** — the Write scope is a hard-coded literal
  `Write(.mini/security/**)`, not derived from `outputPath`; pinned by
  `securityAllowedTools.test.ts`. `Edit` and `Bash(mini findings add:*)` are
  asserted absent. So even a traversal `outputPath` cannot widen the write scope.
- **Path construction, flag modes** — phase-flag slug uses
  `input.fromPhase/toPhase`, already constrained to positive integers by
  `parsePhaseNumber` (`src/cli.ts:15-21`); ref-flag slug uses 7-char slices of
  SHAs resolved by `git rev-parse --verify ^{commit}` — hex, filename-safe. No
  traversal via those two modes.
- **Untrusted parsing** — a malformed/oversized `state.json` makes `loadHeader`
  throw or `version`-mismatch into `LegacyStateError`; a malformed phase file
  makes `loadPhase` return `null` (try/catch at `store.ts:178-184`). Failures
  surface as a logged error and a clean `null` exit from `resolveSecurityTarget`,
  not a crash mid-session or a silent corrupt write.
- **Range resolution** — `resolveRange`/`verifyRef` (pre-existing) run git via
  `runGit` argv arrays, refs verified before use; the new code only consumes their
  validated SHAs.
- **Dependency surface** — no `package.json`/lockfile change in this commit; no
  new third-party package, nothing added at install time.
