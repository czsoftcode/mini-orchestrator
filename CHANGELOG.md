# Changelog

All notable changes to this project are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

### Changed

- **CI actions bumped to their current majors.** `.github/workflows/ci.yml` now
  uses `actions/checkout@v5` and `actions/setup-node@v5` (was `@v4`). The old
  majors ran on Node 20, which GitHub forces to Node 24 from 2026-06-16 (removed
  2026-09-16); the bump keeps CI running without the deprecation warnings. The
  Node test matrix (`20, 22`) is unchanged.

- **`adversarial-project` now reminds you to run a separate security pass (backlog
  item 5).** The correctness red-team used to mention the built-in `/security-review`
  only in passing, so the security pass silently never ran unless you remembered it.
  The prompt now closes with an explicit, reminder-only block — once the phase is
  **done and committed**, run `mini security` in a **separate terminal** (clean
  context, its own report) — and the in-prompt "Security is out of scope" note plus
  the `/mini:adversarial-project` slash command point at the project's own
  `mini security` pass instead of `/security-review`. It stays a reminder: nothing is
  auto-run and no security findings are filed into `mini findings`.

### Added

- **Close findings by hand: `mini findings resolve <id...>` / `reopen <id...>`.**
  Until now a finding was only ever closed automatically, when a whole phase saved
  with `--from-finding` reached `done`; there was no way to close a finding a
  multi-fix phase addressed or to dismiss a `nit`. The two new subcommands flip one
  or more findings (`mini findings resolve 160-1 160-2`) and are idempotent — an id
  already in the target state is a benign no-op, not an error, while an unknown or
  malformed id is reported and makes the call exit non-zero without stopping the
  rest of the batch. (Recording *why* a finding was closed via `--reason`, and
  wiring closing into the `do`/`done` lifecycle, are tracked as follow-ups.)

- **Security & trust-boundary docs.** New [`docs/security.md`](docs/security.md)
  documents the agent-trust boundary (finding SEC-1): mini feeds git-shared
  `.mini/` content into the agent's prompts, so a cloned/pulled repo with a
  poisoned `.mini/` is a prompt-injection vector when running `mini auto`
  (`acceptEdits`). It records the mitigations — read an untrusted `.mini/` before
  running, don't run `mini auto` unattended on un-reviewed repos, and the human
  `done` checkpoint as the main safety net. README gained a short `## Security`
  section linking to it, and the warning is cross-linked from `docs/README.md` and
  the [`mini auto`](docs/non-interactive/auto.md) notes.

### Security

- **Path-traversal guard at the graph write site (defense-in-depth, SEC-4).** The
  full graph rebuild now asserts each collected source path stays inside
  `.mini/graph/` before writing its node, throwing on an absolute or `..`-escaping
  path. Unreachable today (the collector only yields repo-relative `git ls-files`
  paths), it blocks a future collector regression from silently writing graph
  nodes outside the project tree — matching the check the incremental update path
  already had.

### Fixed

- **CI no longer fails `npm test` because of ambient color detection.** GitHub
  Actions sets `CI=true`, which picocolors treats as "color supported" and enables
  ANSI escapes even without a TTY. Two `status` assertions matched literal
  substrings like `2. Title`, but `pc.bold` inserts escape codes inside the title,
  so the substring no longer matched — green locally (no `CI`), red on CI. The
  vitest config now forces `NO_COLOR=1` for the whole test run, making output
  deterministic regardless of the ambient environment.
- **Repeated reviews no longer stack stale findings (backlog item 2).** The run
  report's free text is embedded as `# Implementation report` into the
  `done`/`verify`/`adversarial` prompts. If an older report still carried a
  `## Adversarial findings` or `## Verify findings` section, the reviewer read
  those prior verdicts as part of the implementation log and a re-run kept
  re-stacking them. Those sections are now stripped (exact-title match, up to the
  next `##`-or-higher heading) before embedding; a body that is *only* a stale
  section falls back to the git-diff path in `adversarial`.
- **Corrupt phase file no longer silently loses its detail (blocker 167-1).** The
  phase-detail loader used to treat an unreadable `.mini/phases/phase-NNN.json`
  (truncated, half-written, or left with git merge-conflict markers) exactly like
  a missing one — it degraded to the bare header summary, dropping
  goal/steps/notes, and the next save made the loss permanent. Reads now
  distinguish the two: a missing file stays a benign result, but corrupt JSON or
  any other read error throws a clear `CorruptPhaseError` naming the file, so
  `verify`/`adversarial`/`load` report the real problem instead of a misleading
  "no phase, run `/mini:next`".
- **`adversarial-project` dedup step is now permitted.** The reviewer prompt tells
  the agent to run `mini findings list` first so the same issue isn't filed twice,
  but `mini findings list` was missing from the command's allowed tools — in a
  terminal session that triggered a permission prompt and the dedup silently didn't
  run. Added `Bash(mini findings list:*)` to the `adversarial-project` tool set.
- **`mini findings add --source project` is now accepted (blocker 178-1).** The
  `adversarial-project` reviewer prompt instructs you to record each finding with
  `--source project`, but the CLI's `--source` choices only allowed
  `adversarial | verify`, so the command was rejected before reaching the store —
  the whole project-range review was unrecordable and reviewers had to mislabel
  findings as `adversarial`. The `--source` choices now derive from
  `FINDING_SOURCES`, so the CLI can no longer drift from the data model.
- **Stale-findings stripping no longer truncates reports with code fences
  (finding 178-2).** The cleanup that removes leftover `## Adversarial findings` /
  `## Verify findings` sections before a report is inlined into the
  `done`/`verify`/`adversarial` prompts scanned headings without noticing
  ```` ``` ````/`~~~` code blocks. A report whose impl log showed such a heading
  *inside* a fenced example was silently cut off from that line onward; conversely
  a real stale section containing a fenced heading line ended early and leaked its
  tail. Fenced blocks are now honored — headings inside a fence are treated as
  literal text.
- **`mini doctor` no longer crashes on a corrupt phase file (finding 178-3).**
  `doctor` is the tool you run to find out *why* a project is broken, yet its
  full-state read was the one unguarded read in a function where every sibling
  read is wrapped — so a single unreadable `.mini/phases/phase-NNN.json`
  (truncated or carrying git merge-conflict markers) made `CorruptPhaseError`
  abort the whole diagnostic. The read is now caught and rendered as a `fail`
  "Phases" check naming the file (the phase-hygiene checks that need full state
  are suppressed); any non-corrupt error is still re-thrown so genuine bugs stay
  loud.

## [1.22.0] - 2026-06-15

### Added

- **Docs for the security review command.** Added reference pages for both
  [`mini security`](docs/non-interactive/security.md) /
  [`/mini:security`](docs/interactive/security.md) under `docs/`, covering the
  range rules (no flags = last completed phase, phase vs. git-ref forms, the
  phase-mode range-end caveat, genesis fallback), the report-path scheme, the
  scoped tool set, and the inline-is-not-scoped warning. `docs/README.md` gained a
  **Security review** row in the Review table.

- **`/mini:security` slash command.** `install-commands` now generates the
  `/mini:security` command idempotently. Its body forwards the range flags
  straight to `mini context security $ARGUMENTS` (no flags = the last completed
  phase; `--from-phase`/`--to-phase` or `--from`/`--to` for a range) and carries
  the same independence warning as the adversarial commands. It adds one extra
  caveat: the scoped tool set the terminal `mini security` enforces does **not**
  apply to an inline slash run, which uses the current session's permissions — so
  the slash command is a convenience, not an isolated audit (prefer a terminal
  `mini security` run, or `/clear` first).

- **`mini security` command.** Opens a fresh Claude Code session for an
  independent **security review**. With no flags it reviews the last completed
  phase (from its pre-commit SHA to `HEAD`); `--from-phase`/`--to-phase` or
  `--from`/`--to` review a range. It runs report-only with read + read-only-git
  tools and a single write scoped to `Write(.mini/security/**)` (no `Edit`, no
  findings-store write) — the reviewer writes a durable Markdown report to
  `.mini/security/<range>.md` itself. Report paths: `phase-<id>.md` for the
  default, `range-<A>-<B>.md` for a phase range, `range-<short>-<short>.md` for a
  git-ref range.

- **Docs for the adversarial review commands.** Added reference pages for both
  `mini adversarial` / `/mini:adversarial` and `mini adversarial-project` /
  `/mini:adversarial-project` under `docs/interactive/` and
  `docs/non-interactive/`, including the full range rules (phase vs. git-ref
  forms, mutual exclusion, genesis fallback). `docs/README.md` gained a **Review**
  section grouping these commands with `mini findings`.

- **`mini adversarial-project` command.** Opens a fresh Claude Code session for an
  independent red-team review of a **range of phases**, scoped by phase numbers
  (`--from-phase`/`--to-phase`) or git refs (`--from`/`--to`). It runs report-only
  with read + read-only-git tools and `mini findings add` (no `Edit`), mirroring
  `mini adversarial`. The first message is built from `.mini/project.md`, the
  resolved range and the in-range phase list.

- **`/mini:adversarial-project` slash command.** `install-commands` now generates
  the `/mini:adversarial-project` command idempotently. Its body forwards the
  range flags straight to `mini context adversarial-project $ARGUMENTS`
  (`--from-phase`/`--to-phase` or `--from`/`--to`) and carries the same
  independence warning as `/mini:adversarial` (prefer a terminal run or `/clear`
  first, since an inline review shares the author's context).

- **`mini context adversarial-project` sub-command.** Prints the same red-team
  prompt as the interactive command to stdout, built from the shared range
  builder, and takes the same range flags (`--from-phase`/`--to-phase` and
  `--from`/`--to`). On an invalid or missing range it writes nothing to stdout,
  reports the reason on stderr and exits non-zero. This is the prompt source the
  upcoming `/mini:adversarial-project` slash command will call.

- **`project` finding source.** `mini findings add --source project` is now
  accepted and the value survives the findings-store round-trip, alongside
  `adversarial` and `verify`. Groundwork for the upcoming cross-project
  `adversarial-project` review; no command emits it yet.

### Fixed

- **`adversarial-project` range starting at the first phase.** A phase-number
  range whose start is the project's first phase no longer fails with "no
  recorded pre-commit SHA". When that phase has nothing committed before it, the
  range start now falls back to the git empty-tree object, so the review diffs
  from project genesis. Other phases with a missing pre-commit SHA still report a
  clear error. (The range *end* for very early phases remains a separate
  limitation.)

## [1.21.0] - 2026-06-14

### Added

- **Verify findings go to the durable findings store.** `mini verify` /
  `/mini:verify` now records each finding by calling `mini findings add --source
  verify` into `.mini/findings/`, instead of appending a `## Verify findings`
  section into the run report. Like adversarial findings, they survive a corrupt
  or missing report and a closed phase, and surface later in `mini next` as
  candidate fix phases. `mini findings add` gained a `--source <adversarial|
  verify>` flag (default `adversarial`) and each stored finding carries a
  `source` tag; `mini findings list` shows it.

### Changed

- **The findings store now holds both review kinds.** `.mini/findings/` is shared
  by the adversarial red-team and the verify review; its header reads `# Review
  findings` and `mini next` lists open findings from both, tagged by source
  (`id · severity · source · where — title`). Older finding files with no
  `**Source:**` line are read as `adversarial` (backward compatible).

- **Completing a fix phase resolves its linked finding.** When a phase created
  with `--from-finding` closes (`mini done`), mini now flips that adversarial
  finding from `open` to `resolved` and folds the change into the phase commit;
  `mini undo` reopens it so the two stay in sync. Tolerant by design — a missing,
  already-resolved or hand-edited finding never breaks `done`/`undo`. This closes
  the loop: a finding is born `open` in the review, links to a fix phase, and
  clears itself once that phase is done.

- **Open adversarial findings surface in `mini next` / `/mini:next`.** When you
  propose the next phase, mini now lists the still-open findings from the red-team
  review (`id · severity · where — title`) as candidate **fix phases**, alongside
  the todo backlog.

- **`--from-finding <id>` links a phase to the finding it fixes.** When a phase is
  born from an open adversarial finding, save it with `mini next --apply
  --from-finding <id>`: mini records the link on the phase. This does **not** close
  the finding (it stays open until the fix is done and verified) — unlike
  `--from-todo`, and an unknown id fails the save rather than warning. The link
  lets `mini discuss` / `mini plan` read the finding's full detail (title,
  severity, location, body) straight from disk in any later session, so the
  planner works from what the red-team actually found, not from chat memory.

- **`mini findings` — a durable store for adversarial review findings.** Findings
  now live in their own `.mini/findings/phase-{id}.md` files, versioned with the
  code (like `.mini/decisions/` and `.mini/memory/`) — no longer buried in the run
  report of a phase nobody reopens once it closes. Each carries a severity, an
  `open`/`resolved` status and an optional location. `mini findings add` records
  one (mini owns the id, format and origin phase, so the reviewer never edits a
  file), and `mini findings list [--all]` shows the open findings across all
  phases. Surfacing them in `next`/`plan`/`do` and a `resolve` command are planned
  follow-ups.

- **Findings now record the baseline commit they were reviewed against.** When
  `mini findings add` runs inside a git repo it stamps the finding with the
  current `HEAD` SHA (shown shortened as `@1a2b3c4` in `mini findings list`).
  Because a review runs between `do` and `done` while the phase work is still
  uncommitted, this is the phase's *parent* commit — the code state the review
  started from — recorded honestly as a baseline, not the reviewed commit. It lets
  a later consumer judge whether a finding may be stale after the code moved on.
  Additive: findings recorded before this, or outside git, simply have no SHA.

- **`mini adversarial` — an independent red-team review step.** A new command and
  `/mini:adversarial` slash command run a reviewer that switches into the role of
  someone who did *not* write the code and hunts for what breaks it (unhappy path,
  silent assumptions, premature complexity, gaps in tests), reading the real
  `git diff` of the phase. It targets the current phase (or the last closed one),
  records each finding via `mini findings add` (and prints a
  `adversarial: pass | findings | blocked` status line for the human), and never
  moves the phase state — closing stays a human decision in `done`. The terminal
  command spawns a fresh Claude session (clean context = a genuinely independent
  reviewer) that is **report-only**: it gets read + search tools and read-only git
  (`Read`/`Grep`/`Glob`/`LS` + scoped `git diff`/`log`/`show`) but **no `Edit`**,
  so it cannot modify the code it reviews — its single write is the scoped
  `mini findings add`. The inline slash command is honest that it shares the
  current session's context and points to the terminal command or `/clear` for
  real independence.

## [1.20.0] - 2026-06-09

### Added

- **C/C++ mapper for `mini map`.** The project graph now covers
  `.c`/`.h`/`.cpp`/`.hpp`/`.cc`/`.hh` files: `#include` imports (local
  `"util/foo.h"` and system `<vector>` forms stay distinguishable), free
  functions with parameter/return signatures (definitions and prototypes,
  multi-line declarations, trailing return types, default values),
  `class`/`struct` definitions with their public methods, `enum`/`enum class`,
  `typedef` (incl. `typedef struct {...} Name` and function pointers) and
  `using` aliases — all with line anchors for targeted reads. Declarations
  inside `namespace { }` and `extern "C" { }` blocks are mapped too, and
  `CMakeLists.txt` now counts as a project marker. Same regex trade-offs as
  the other mappers: preprocessor conditionals are not evaluated and
  macro-generated declarations are invisible; `static` free functions count as
  API only in headers.

### Changed

- **Prompt hardening for Fable 5 and newer model generations.** Newer models
  (Opus 4.7/4.8, Fable 5) are tuned to be concise between tool calls and to
  avoid blocking questions, so they tended to compress mini's overviews into a
  one-line summary and to save state without waiting for approval. All slash
  command bodies and session prompts now state the two contracts explicitly,
  via shared hints in `src/prompts/sessionHints.ts`: (1) command output shown
  to the user (`status`, `doctor`, `changelog`, `map`, `audit`, `model`,
  `todo`, `init`, `undo`, `upgrade`, `import-gsd`) must be printed **verbatim
  in the final message** — the user does not read the Bash tool result; and
  (2) every question to the user (`next`, `plan`, `project`, `decision`,
  `done`, `verify`, plus the confirmation steps of `init`, `undo`, `upgrade`,
  `model`, `import-gsd`) **ends the turn** — no `mini ... --apply` may run in
  the same turn as the question. `auto` is deliberately untouched (autonomous
  mode wants brevity). Trade-off: well-behaved models now print long outputs
  in full and approvals cost one extra turn.

## [1.19.0] - 2026-06-09

### Fixed

- **Status line: Fable models get the 1M context window.** `windowForModel()`
  now recognizes Fable in the model display name, so the usage percentage is
  computed against 1M instead of 200k. In addition, any model whose id carries
  the `[1m]` suffix (e.g. `claude-fable-5[1m]`) gets the 1M window regardless
  of its display name — a future-proof signal for new long-context models
  without a code change.

## [1.18.0] - 2026-06-07

### Added

- **`/mini:project` (and `mini project`) — shape the project vision.** A new
  plan-before-code step that runs after `mini init` and **enriches the existing
  `project.md`** with **Approach**, **Non-goals** and **Success criteria** (the
  existing name / target user / constraints are kept). In a session Claude runs a
  short, deliberately critical four-stage interview (frame & remove assumptions →
  rough plan with trade-offs → non-goals as rules → final check + success
  criteria) and saves the result through the `mini project --apply` contract
  (stdin), which writes only `project.md` and never the phase state. `project.md`
  stays a one-page steering doc — only the main points are written, not a full
  spec.
- **README: "Walk through your first phase" walkthrough.** A collapsible
  `<details>` block in Quick start shows the first-five-minutes **slash-command**
  path (`/mini:init` → `/mini:next` → `/mini:plan` → `/mini:do` → `/mini:done`) as
  a short `You:`/`Claude:` conversation per step — the interactive chat experience,
  not the CLI transcript. Snippets are explicitly labelled illustrative so the
  non-deterministic chat output isn't read as a fixed transcript.
- **README: "How is this different from Claude Code's plan mode?" section.** A new
  section (above the install steps, right after the demo) preempts the "why not
  the built-in plan mode?" question with a short comparison table (scope,
  persistence, memory, git, autonomy). Framed honestly — native plan mode and its in-session todos are
  ephemeral; mini is the persistent, multi-session layer on disk — rather than as
  claims about what native plan mode can't do.

### Changed

- **`/mini:plan` and `/mini:discuss` reference `project.md` instead of inlining
  it.** In a running session these slash commands no longer paste the whole
  `project.md` into the prompt every time; they reference it with a read-once
  instruction ("read it only when you don't have it in context"), matching how
  `/mini:do` already worked. Saves tokens per invocation, especially with a richer
  `project.md`. Cold paths are unchanged: `mini next` and the interactive terminal
  `mini plan` / `mini discuss` still inline the full project. The shared wording
  also covers long sessions (compaction) and a fresh session after a crash.
- **README: dropped the hidden CI/billing comment and a redundant disclaimer.**
  The commented-out CI badge with its "GitHub account billing issue" note was
  removed from the public source; the npm/node/license badges stay. The
  "illustrative" demo disclaimer now appears once (in the Quick start
  walkthrough) instead of repeated across sections.
- **README: "See it in action" no longer duplicates the demo as text.** The
  inline `<details>` console transcript of the full cycle was removed; the
  image-not-loading fallback is now a one-line link to the Quick start
  walkthrough, which already shows the same flow as text. Also moved the
  plan-mode comparison section above the install steps (right after the demo)
  so the "why use this" argument comes first. (Combined −30+ lines.)
- **README: "Import from GSD" trimmed and "Workflow tips" moved to docs.** The
  GSD section drops to two sentences (positioning + how to import) keeping the
  [`mini import-gsd`](docs/non-interactive/import-gsd.md) link; the four
  workflow-tips bullets move into a new section in [`docs/faq.md`](docs/faq.md).
  This completes moving the reference-style content out of the README. (−7 lines.)
- **README: "What gets sent to Claude" + graph sections condensed.** The full
  context budget and the per-call cost-line example move into a new
  [`docs/context.md`](docs/context.md) (linked from "Concepts & guides"); README
  keeps a two-paragraph summary — the token-efficiency pitch (softened to
  *roughly* 600–1000 tokens) plus a one-line graph blurb linking to
  [`mini map`](docs/non-interactive/map.md). The standalone
  `## Machine-readable project map` section was folded into "What gets sent to
  Claude". (−12 lines.)
- **README: auto mode consolidated into one section.** The two overlapping auto
  blocks — the 13-line `### Autonomous /mini:auto` flag reference under Commands
  and the standalone `## Auto mode` section — collapse into a single short
  "Autonomous mode" summary (chains phases, `acceptEdits` with Bash still asking,
  human checkpoints at `next`/`done`, `mini stop` to halt) linking to
  [`/mini:auto`](docs/interactive/auto.md) and [`mini auto`](docs/non-interactive/auto.md).
  The per-flag list moves out of the README — it is already documented on both
  pages. (−12 lines.)
- **README: "FAQ" and "Files in the project" moved into `docs/`.** The full
  state/layout reference (`.mini/` tree, state.json/phases/graph/memory prose)
  now lives in [`docs/files.md`](docs/files.md) and the complete FAQ in
  [`docs/faq.md`](docs/faq.md), both linked from a new "Concepts & guides"
  section in [`docs/`](docs/README.md). README keeps only four new-user FAQ
  entries (permission prompts, pause & resume, commit-after-phase, API key vs
  Pro/Max) plus a one-line `.mini/` pointer; the version-bump/undo/memory
  internals are out of the README. (−44 lines.)
- **Demo: the cycle GIF now shows the slash-command flow.** `demo/cycle.sh` was
  rewritten from a CLI walkthrough into the interactive `/mini:*` dialog
  (`/mini:init → next → plan → do → done`) so the GIF matches the primary path
  in Quick start. It stays offline and deterministic: Claude's replies are
  scripted/illustrative, but each `[ok] …` line is real output from the same
  `mini … --apply` a slash command calls under the hood. The README GIF caption,
  alt text and the text-transcript fallback were aligned to the new flow.
- **README: top-level Documentation pointer.** Added a short `Documentation:`
  line near the intro (right after `Website:`) linking to [`docs/`](docs/README.md)
  as the central command reference, so the full two-variant reference is
  discoverable above the fold. The existing 📖 callout in `## Commands` was
  reworded ("Browse the per-command pages …") so the two pointers have distinct
  roles instead of being duplicates.
- **README: slimmed the `## Auto mode` and `## Import from GSD` sections.** Both
  collapse to a short pointer each, linking to [`mini auto`](docs/non-interactive/auto.md)
  (and [`/mini:auto`](docs/interactive/auto.md)) and [`mini import-gsd`](docs/non-interactive/import-gsd.md)
  (README −32 lines). The auto report contract, the one-session-per-phase
  rationale and the 3-pass retry were **added to `docs/non-interactive/auto.md`**
  first; the GSD positioning sentence (mini as a lighter-weight alternative) is
  kept in the README.

- **README: slimmed the graph sections into one blurb.** The three sections
  (`## Machine-readable project map`, `### Incremental update (--file)`,
  `### Auto-update after an edit (hook)`) collapse to a single short paragraph plus
  a link to [`mini map`](docs/non-interactive/map.md) (README −35 lines). The
  `--file` incremental nuances and the full PostToolUse hook `settings.json`
  snippet were **added to `docs/non-interactive/map.md`** first, so the detail moved
  rather than being lost.

- **README: slimmed the `## Models` and `## Status line` sections.** Both are now
  short blurbs that link to the full docs ([`mini model`](docs/non-interactive/model.md),
  [`mini install-statusline`](docs/non-interactive/install-statusline.md)) instead of
  re-documenting flags and status-line internals inline (README −48 lines). The
  status-line gauge/segment anatomy and the cache/refresh mechanics (temp-dir cache,
  detached background refresh, per-session check + 5h cooldown) were **added to
  `docs/non-interactive/install-statusline.md`** first, so the detail moved rather
  than being lost. The per-call token-cost example moved next to `## What gets sent
  to Claude`.

- **README: slimmed the command sections, single reference in `docs/`.** The full
  24-row `## Commands` table and the duplicate `## mini commands directly in Claude
  Code` slash catalogue are gone. A concise `## Commands` block now explains the
  two-variant model (interactive `/mini:*` vs. terminal `mini *`) and points to the
  complete reference in [`docs/`](docs/README.md), so the command catalogue lives in
  one place instead of being copied into the README (−57 lines). The
  `### Autonomous /mini:auto` explanation is kept.

- **Problem-first README intro.** The README now opens with a problem-first pitch
  (hook + the two ways an unsupervised agent goes off the rails + the
  *propose → plan → implement → verify* rhythm) instead of a terse technical
  description. The heading is `# mini-orchestrator` (matching the npm package and
  website; the CLI command stays `mini`), with npm version / Node / license
  badges. The top region is reordered to intro → *See it in action* → *Quick
  start* (slash commands as the primary flow, the CLI loop secondary) →
  *Requirements* → *Installation* (the npx, no-sudo and from-git notes folded into
  collapsible blocks). The GSD comparison moved out of the product definition into
  the *Import from GSD* section.

### Removed

- **Sponsorship asks.** Dropped the README *Support* and *Backers* sections and
  the `.github/FUNDING.yml` (and thus the repository's Sponsor button) — premature
  for a project still gathering its first users.

## [1.17.0] - 2026-06-04

### Added

- **Decision records (ADRs) for phases.** A phase can now carry a lightweight
  decision record in `.mini/decisions/phase-<n>.md` that captures the *why*
  behind a non-trivial choice (the rejected alternative and the reason) — what
  the goal and the commit message don't preserve. The file's existence is the
  single source of truth (no flag in the state, nothing to keep in sync), the
  format is lean (heading + `Decision` + `Why`, max one per phase, no `NNNN-`
  numbering). `mini status --phase <n>` renders it under a `Decision:` heading
  and `mini status --phase <n> --json` carries it in a new `decision` field.
  Collecting them automatically, an overview marker, a `doctor` orphan-check and
  `undo` handling are follow-ups.
- **Writing decision records.** New command `mini decision --apply` writes a
  phase's ADR to `.mini/decisions/phase-<n>.md` from stdin (targets the current
  phase, so run it before `mini done --apply` to land it in the phase commit).
  An empty body or a body without a top-level `# ` heading writes nothing — "no
  decision" stays the file's absence.
- **On-demand `/mini:decision`.** Drafting an ADR is its own command: it drafts a
  lean record from what actually happened, shows it to you for approval, and
  writes it — but only on a real crossroads (a weighed-and-rejected alternative),
  not routine choices. `/mini:do` and `/mini:done` no longer carry the full
  instruction; they only point you to `/mini:decision` when a phase makes a real
  decision, which keeps their prompts lean (the `done` prompt drops ~270 tokens
  per phase).
- **ADR marker in `mini status`.** The phase overview now flags every phase that
  carries a decision record with a compact `✎ ADR` marker after its title, and
  `mini status --json` sets `hasDecision: true` for it. The whole overview costs a
  single `readdir` of `.mini/decisions/` — no per-phase reads.
- **`mini doctor` orphan-check for decision records.** A new "Decisions" check
  flags `phase-<id>.md` files in `.mini/decisions/` whose phase no longer exists
  in the state (leftovers after `mini undo` / `migrate --renumber`), mirroring the
  existing stale-run-reports check.

## [1.16.0] - 2026-06-03

### Added

- **Shell completion.** New console-only command `mini completion <bash|zsh>`
  prints a completion script that completes `mini`'s subcommands, each command's
  option flags (e.g. `mini done --`+Tab → `--apply --accept-verify --bump
  --push`) and fixed flag values (`mini done --bump`+Tab → `none patch minor
  major`). Enable it with `source <(mini completion bash)` (or `zsh`) in your
  shell rc; the bash script needs no `bash-completion` package. The commands,
  flags and values are derived from the CLI at generation time, so they stay in
  sync across upgrades.

- **`mini next --apply --from-todo <n>`.** When you save a phase that grew out of
  a [todo](docs/non-interactive/todo.md) backlog item, the new flag ticks that
  item off in `.mini/todo.md` automatically, so the backlog never drifts out of
  sync. The `/mini:next` prompt now lists open items with their archive number
  (`- [n] …`) and tells Claude to pass `--from-todo <n>`. A bad reference (out of
  range or already done) only warns — the phase is still saved.

- **`mini status --phase <n>`.** Zoom in on a single phase instead of the whole
  overview: its title, goal, status and duration, every step **with its planning
  detail**, and the phase's run report (verdict, items pending verification, and
  the free-text notes). Works with `--json` too for a machine-readable object. An
  unknown `<n>` fails with a clean error.

- **`mini doctor` phase-hygiene checks.** The health check now also flags phases
  stuck in `doing` with no open work left (pointing at `mini done`) and stale run
  reports in `.mini/run/` whose phase no longer exists (leftovers after
  `mini undo` / `migrate --renumber`).

### Changed

- **`--bump` now validates its value.** The `--bump` option on `mini done` /
  `mini auto` is defined with an explicit choice set, so an invalid level (e.g.
  `--bump foo`) is rejected with a clear "Allowed choices are none, patch, minor,
  major" message and the choices show up in `--help`.

## [1.15.0] - 2026-06-02

### Added

- **Continuous integration.** Added a GitHub Actions workflow
  (`.github/workflows/ci.yml`) that runs `typecheck`, the test suite and `build`
  on push to `main` and on pull requests, across Node 20 and 22, plus a CI status
  badge in the README.

- **README "Backers" section.** A thank-you/call-to-action section with a
  sponsorkit-style `<!-- sponsors -->` placeholder, ready to list project backers
  once GitHub Sponsors goes live.

- **GitHub Sponsors funding.** Added `.github/FUNDING.yml` (`github: czsoftcode`)
  so the repository's Sponsor button points at GitHub Sponsors, plus a short
  "Support" section in the README.

- **GitHub community files.** Added contributor onboarding under `.github/`: issue
  forms for bug reports and feature requests (`ISSUE_TEMPLATE/*.yml`) with a
  `config.yml` that disables blank issues and links to Discussions/docs/website, a
  pull-request template with a checklist, and a root `CONTRIBUTING.md` (dev setup,
  PR workflow, language policy, links into the README and LICENSE).

- **README demo of the workflow cycle.** A recorded terminal GIF of the full
  `init → next → plan → do → done` loop now sits at the top of the *Quick start*
  section (with a `<details>` text transcript as a fallback). It is produced from
  a real, fully offline run — the new `demo/cycle.sh` drives every step through
  the non-interactive `--apply` flags (no Claude API), and `demo/record.sh`
  records it with asciinema and renders `demo/cycle.gif` via agg. Re-run
  `demo/record.sh` to refresh the GIF.

## [1.14.0] - 2026-06-02

### Added

- **`mini install-statusline` command.** The opt-in counterpart to the install:
  enables the mini status line by adding a `statusLine` block to
  `~/.claude/settings.json` (creating the file if missing, preserving every other
  key). It never overwrites an existing status line — an already-present mini one
  is a no-op, a foreign one is left untouched and reported. Supports `--dry-run`.
  This rounds out the install/uninstall symmetry (`install-commands` +
  `install-statusline` in, `uninstall` out) and is what the postinstall hint now
  points to for turning the status line on.

- **Zero-touch trial via `npx`.** The `install-commands` command is no longer
  hidden, so `npx mini-orchestrator install-commands` is a documented way to try
  mini **without a global install**: npx runs it one-off, it asks where to put the
  `/mini:*` commands (this project vs all projects), and it never writes into
  `~/.claude/settings.json` on its own. New top-level README section "Try it
  without touching `~/.claude`" and reference pages
  `docs/non-interactive/install-commands.md` and
  `docs/non-interactive/uninstall.md`.

- **`mini uninstall` command.** A visible counterpart to install/postinstall that
  cleans up everything mini wrote outside the project tree: it removes the
  `/mini:*` slash commands (user-scope `~/.claude/commands/mini` and, when
  present, the project-scope `.claude/commands/mini`) and strips **only mini's
  own** status line from `~/.claude/settings.json` — a foreign status line is
  left intact. Supports `--dry-run` (preview, changes nothing) and `-y/--yes`
  (skip the confirmation); without a TTY and without `--yes` it aborts rather
  than act unprompted. Run it before/after `npm uninstall -g mini-orchestrator`
  to fully clean up.

### Changed

- **Global install no longer silently edits `~/.claude/settings.json`.** On a
  non-TTY global install (`npm i -g mini-orchestrator`) mini still writes the
  `/mini:*` slash commands (additive, namespaced), but the status line is now
  opt-in — it is never wired into your `settings.json` without a TTY to ask
  first. The postinstall prints an honest summary of what it created plus a
  one-line full-removal hint. The interactive install still offers the status
  line as before.

## [1.13.0] - 2026-06-02

### Changed

- **`mini update` is now an alias for `mini upgrade`.** Typing `mini update`
  checks npm for a newer `mini-orchestrator` and installs it (with the same
  `--check` / `--yes` flags) — so a slip between the two similarly named commands
  does the expected thing, silently. Its previous behavior (syncing the project's
  generated `.mini/` skeleton + slash commands) is no longer reached via
  `mini update`; use `mini install-commands` to refresh the slash commands. The
  `mini doctor` out-of-date-commands hint now points to `mini install-commands`.

### Added

- **`/mini:import-gsd` slash command.** GSD import can now run from inside Claude
  Code, following the mini pattern (no nested Claude session, no interactive
  hang). `mini import-gsd` gained two non-interactive forms: `--prompt` prints
  the extraction prompt to stdout, and `--apply` reads the extraction response
  from stdin, parses it (preserving phase statuses) and saves the project +
  phases (`--force` overwrites an existing project, keeping its model config).
  The slash command checks `.planning/`, confirms before overwriting, has the
  in-session Claude read `.planning/` and produce the contract, then pipes it
  into `mini import-gsd --apply`. The bare `mini import-gsd` terminal flow is
  unchanged (18 generated slash commands now).

- **Per-command documentation under `docs/`.** Every user-facing command now has
  a detailed reference page, split by variant: `docs/interactive/` for the
  `/mini:*` slash commands and `docs/non-interactive/` for the `mini *` CLI
  commands. Each page has a description, usage/flags, worked examples with sample
  output, edge-case notes, and links to its sibling variant and related commands.
  `docs/README.md` is the index, grouped like the website (Project setup / Phase
  loop / Autonomous / State & control). `mini stop` has a single page under
  `non-interactive/` (console-only, no slash variant). Mirrors the structure of
  [miniorchestrator.com/en/docs](https://miniorchestrator.com/en/docs); the
  README will later link to these pages.

- **Reference pages for `import-gsd`.** Added `docs/interactive/import-gsd.md`
  and `docs/non-interactive/import-gsd.md` — the one command that was still
  missing its docs — and listed `import-gsd` in the `docs/README.md` index under
  Project setup. Now every user-facing command has both variant pages.

### Changed

- **Project website.** The package `homepage` now points to
  [miniorchestrator.com](https://miniorchestrator.com) (previously the GitHub
  README), and the README links to it. `repository` and `bugs` still point to
  GitHub.

## [1.12.0] - 2026-06-01

### Added

- **`mini status --json`.** A machine-readable JSON object (project title, the
  "what" line, configured models, `currentPhaseId`, the open-idea count, and the
  phases with their status, `startedAt`/`completedAt`, `durationMs` and steps) for
  scripts and integrations. Printed to stdout with no decoration; the human
  overview is unchanged without the flag.

- **Phase duration in `mini status`.** Each finished phase now shows how long it
  took (a compact `(took 3m)` / `(took 2h 5m)` suffix), computed from its
  `startedAt`/`completedAt` timestamps; phases without both timestamps show
  nothing.

- **`mini doctor` command and `/mini:doctor` slash command.** A new `mini doctor`
  prints a health-check checklist of the project setup — the state and its schema
  version (legacy → `mini migrate`, missing → `mini init`), `project.md` and
  `CHANGELOG.md` presence, the installed slash-command count vs the expected
  number (→ `mini install-commands` / `mini update`), and mini version freshness
  from the cache (→ `mini upgrade`) — each line marked ok/warn/fail with a fix
  hint. Read-only; the `/mini:doctor` slash command relays it (17 generated
  commands now).

- **`mini changelog <version>`.** The changelog command takes an optional
  version argument and prints just that version's section (tolerant of a leading
  `v`, e.g. `v1.11.0`); an unknown version is reported with the list of available
  versions. Exposed through the `/mini:changelog` slash command too. (A positional
  argument rather than `--version`, which collides with the global version flag.)

## [1.11.0] - 2026-06-01

### Added

- **`mini changelog` command and `/mini:changelog` slash command.** A new
  `mini changelog` prints the project's `CHANGELOG.md` changes: by default the
  latest released version's section, `--unreleased` the pending `[Unreleased]`
  section, and `--all` the whole history. A missing changelog is reported
  gracefully. The read-only `/mini:changelog` slash command relays the same
  output in Claude Code (16 generated commands now).

- **`mini todo` maintenance and visibility.** The ideas archive gains two
  housekeeping actions — `mini todo edit <n> "<text>"` rewrites an item's text in
  place (keeping its done state) and `mini todo clear` drops all ticked-off items
  at once — and `mini status` now shows the open-idea count (`Ideas: N open`) in
  its header when the archive has open items. The `/mini:todo` `argument-hint`,
  slash body and the listing's actions hint list the new actions.

- **Feeding the todo archive with Claude's ideas.** Two ways to fill the
  ideas/changes backlog without starting a phase or hunting for ideas elsewhere:
  (1) when `mini next` / `/mini:next` proposes its own ideas (the "leave it to
  me" path), it now sketches 2-3 candidates, takes one as the phase and offers to
  stash the rest into the archive via `mini todo add`; (2) a new `/mini:todo
  suggest` (alias `ideas`) action has Claude review the project (project.md,
  phase history, the machine map) and write a batch of small, concrete ideas
  straight into `.mini/todo.md` (skipping duplicates).

### Changed

- **`mini todo` listing now shows the available actions.** After the
  `N open / M total` summary the listing prints a one-line hint
  (`Actions: list · add "<text>" · done <n> · remove <n>`), so the sub-commands —
  including the explicit `list` action (the same as a bare `mini todo`) — are
  discoverable without consulting the help. The `/mini:todo` `argument-hint` and
  the CLI description now list `list` as well.

## [1.10.0] - 2026-06-01

### Added

- **`mini todo` command and `/mini:todo` slash command.** A new `mini todo`
  keeps an archive of future ideas and changes in `.mini/todo.md` (a plain,
  hand-editable markdown checklist): `mini todo` lists the numbered items
  (open `[ ]` / done `[x]`), `add "<text>"` appends an open idea, and
  `done <n>` / `remove <n>` act on the listed number. The `mini next` /
  `/mini:next` prompt now surfaces the open items as candidate phase ideas, so
  ideas collected earlier resurface when it's time to pick the next phase. The
  matching `/mini:todo` slash command maps its arguments to the right
  `mini todo` call (15 generated commands now).

- **`mini upgrade` command and `/mini:upgrade` slash command.** A new
  `mini upgrade` checks npm for a newer `mini-orchestrator`, reports
  current → latest, and (after confirming) installs it with
  `npm install -g mini-orchestrator@latest`. `--check` only reports without
  installing; `--yes` installs non-interactively. A local dev build
  (`install-local`) is detected and left untouched with a hint. The matching
  `/mini:upgrade` slash command is non-interactive — it previews with
  `mini upgrade --check`, confirms in the chat, then applies with
  `mini upgrade --yes` (14 generated commands now), and the install hint lists it.

- **Status-line upgrade indicator.** When a newer mini version is available on
  npm, the status line appends a yellow `↑ <version>` segment
  (`… 28% · ↑ 1.9.1`). It never blocks on the network: it reads a cached reading
  of the latest published version from the OS temp dir and, when that cache is
  older than 5 hours, fires a detached background refresh (the hidden
  `mini check-version`) to update it for next time. `mini upgrade` does a fresh,
  blocking check and also refreshes the cache.

### Changed

- **Upgrade check now refreshes on every new Claude Code session.** The
  status-line version refresh previously fired only when its cache was older than
  5 hours. It now also fires on each new session (detected via the `session_id`
  in the status payload), so you get a fresh check every time you start Claude;
  the 5-hour TTL then only covers a single long-running session. A short retry
  cooldown keeps a failing fetch from re-firing on every render.

## [1.9.0] - 2026-06-01

### Added

- **`/mini:undo` and `/mini:model` slash commands.** The interactive terminal
  commands `mini undo` and `mini model` now have non-interactive native slash
  counterparts, so they no longer block on a TTY prompt in the Claude Code Bash.
  `/mini:undo` previews the change with the new `mini undo --dry-run` (prints what
  would be reverted, including a possible auto-commit soft-reset, without touching
  anything), confirms in the chat, then applies it with the new `mini undo --yes`
  (skips the `Proceed?` confirmation). `/mini:model` leans on the already
  non-interactive sub-commands (`mini model show` / `<scope> <model>` / `reset`)
  and gathers a missing scope/model in the chat instead of opening the interactive
  picker. Both are generated by `install-commands` / `mini update` (13 commands
  now), and the install hint lists them.

- **`mini verify` terminal command.** A top-level `mini verify` command now opens
  an interactive Claude Code session for the in-depth UI/UX review of the current
  phase (or, when none is in progress, the last closed one), symmetric to
  `mini discuss` and the terminal counterpart of the `/mini:verify` slash command.
  The first message is the same prompt `mini context verify` prints; the session
  runs with the tools needed to write findings into the report and memory
  (`Read`, `Edit`, `Grep`, `Glob`, `LS`). The verify prompt builder was extracted
  from `context.ts` into a shared `verifyContext` module so both entry points use
  identical wording.

- **`--bump` and `--push` switches for `/mini:auto`.** The autonomous slash
  command now parses `--bump <level>` and `--push` from its arguments (alongside
  the existing `--max-phases` / `--yolo` / `--verify` / `--discuss`) and forwards
  them to the final `mini done --apply` of **each** phase in the run — so an
  autonomous run can bump the version and push to the remote just like a manual
  `mini done`. As there, `--push` requires an explicit `--bump patch | minor |
  major`; on its own (or with `--bump none`) nothing is pushed. The underlying
  `mini auto` CLI already accepted these flags; this exposes them through the
  slash command body and `argument-hint`.

## [1.8.0] - 2026-06-01

### Added

- **Parallelism guidance for the execution agent.** The `do` and `auto` prompts
  now carry a shared instruction (`PARALLELISM_HINT`, alongside the existing
  `GRAPH_USAGE_HINT`) on how to batch tool calls: run fragile/stateful commands
  on their own — especially anything touching a server (start/stop, kill, pkill,
  background jobs) — so they don't share a batch with other work; fire
  independent reads and queries in parallel; and keep dependent steps sequential
  when one command's output feeds the next. It lives only in the execution
  prompts (not next/discuss/plan), where there is real work to parallelize.

- **npm package metadata for discoverability.** `package.json` now carries
  `keywords` (claude, claude-code, anthropic, ai, llm, cli, orchestrator,
  workflow, agent, project-management, phases, typescript) so the package shows
  up in npm's full-text search and as clickable tags on its npmjs.com page.
  Also added `author`, `homepage`, `repository` and `bugs`, so the package page
  links to the GitHub repository, README and issue tracker. These take effect on
  the next publish.

## [1.7.0] - 2026-05-31

### Added

- **Version bump now follows the project's language.** When `done` raises the
  version (`--bump patch|minor|major`), it writes it to the place that matches
  the project instead of only `package.json`. Sources are tried in a fixed
  priority and the first one carrying a version wins: `package.json` →
  `Cargo.toml` (`[package]`) → `pyproject.toml` (`[project]`/`[tool.poetry]`) →
  `setup.py` → `composer.json` (only when a `version` field already exists) →
  `__version__ = "x.y.z"` (in a common Python location) → a language-agnostic
  `VERSION` file. When no manifest carries a version, `VERSION` is used and, if
  it does not exist, created with `0.1.0`. The tag (`--push`) and `CHANGELOG`
  stamp read the version from the same source. Writes stay a single-line
  textual replacement — no JSON/TOML reformatting.

### Fixed

- **A global install (`npm i -g`) now sets up Claude Code automatically.**
  Previously the postinstall hook bailed out without a TTY, so a global install
  installed neither the `/mini:*` slash commands nor the status line (npm runs
  lifecycle scripts without a terminal). A global install is now detected
  (`npm_config_global`) and, even without a TTY, installs the slash commands into
  the user scope (`~/.claude/commands/mini`) and wires the status line into
  `~/.claude/settings.json` (only when none exists — a foreign `statusLine` is
  never touched). A local / CI install without a TTY is unchanged: it stays quiet
  and only prints a hint.

## [1.6.0] - 2026-05-31

### Added

- **mini ships its own Claude Code status line.** A new `mini statusline` command
  reads the status JSON Claude Code pipes on stdin and prints one line: the
  (shortened) project directory, the model with its version, the context-window
  size (`200k`/`1M`) and a colored gauge + percentage of the **context-window
  usage** — recovered from the session transcript, since Claude Code does not
  report token counts to the status line directly. Colors are raw ANSI (dir in
  bold cyan, the gauge green/yellow/red by fill) so they survive the piped
  output. On `npm install` the postinstall hook **offers** it (asks first) and
  wires it into `~/.claude/settings.json` — but only when no `statusLine` exists
  yet; an existing one (yours, GSD's, Claude's) is never overwritten, and without
  a TTY it is skipped silently. Disable it by removing the `statusLine` block.

- **The `/mini:*` slash commands are installed automatically by an npm `postinstall`
  hook.** After `npm install` of mini, the hook offers to install the commands and
  asks where — the user-level `~/.claude/commands/mini` (all projects) or the current
  project's `.claude/commands/mini` — defaulting to the scope detected from how Claude
  Code is installed (a project-local `node_modules/.bin/claude` suggests the project,
  otherwise the user level). It is non-interactive-safe: without a TTY (CI, `npm ci`,
  piped install) it writes nothing and only prints a hint with the manual command, and
  any error is downgraded so it never fails the install.

- **mini-orchestrator is now released under the MIT License.** A root `LICENSE` file
  (MIT, © 2026 Stanislav Kremeň) makes GitHub show the "MIT" badge in the repo sidebar,
  the `"license": "MIT"` field in `package.json` makes npmjs.com display it on the
  package page, and the README's license section links to `./LICENSE`. npm always
  includes `LICENSE` in the published tarball, so it ships with the package too.

- **README documents the local dev install.** A note under "From git / for development"
  describes `npm run install-local`: it builds and installs mini under `~/.local`
  (a `~/.local/bin/mini` symlink + a versioned directory with the package files and
  production deps), keeps older versions around for rollback, and is verified with
  `mini --version`.

### Changed

- **`mini install-commands` is now a hidden manual fallback, not the primary install
  path.** Installing the slash commands is normally handled by the `postinstall` hook
  (see Added); the command stays available (hidden from `--help`) for when the hook is
  skipped (`--ignore-scripts`, `npm ci`, CI). It gained `--user` / `--project` to pick
  the location non-interactively and `--dry-run` for a preview. The generator was
  extracted into a shared module (`src/install/commands.ts`) reused by the hook,
  `mini update` and this command, so their output can't drift.

- **`scripts/install-local.sh` is now fully English.** Its header comments and all
  runtime output (`→ installing into …`, `→ production npm install (runtime deps only)`,
  `mini X installed.`, `Try: mini --version`) were translated from Czech. The stray
  Czech build line in `scripts/copy-assets.mjs` (`assety zkopírovány`) was translated to
  `assets copied` as well.

- **`CLAUDE.md` is now fully English.** The project instructions are written in English
  so any developer of the public tool can read the conventions without translating. The
  file keeps the i18n policy (everything inside the program is English) and the
  "left untouched" list (identifiers, technical terms, quoted foreign output, parser
  response contract & status words); the maintainer's personal "communicate in Czech"
  rule was removed (it lives in the maintainer's global `~/.claude/CLAUDE.md`).

## [1.5.0] - 2026-05-31

### Added

- **The lifecycle command messages are translated to English.** The runtime output of
  `mini next / plan / do / done / auto / discuss` (and `mini context`) — `log.*`
  messages, interactive `ask()` prompts and their choices — is now English, together
  with the in-code comments/JSDoc. The model-scope labels (`SCOPE_LABELS` used by
  `mini model`) are English too. Command names, flags, the parser response contract
  (`TITLE:`/`GOAL:`/`STEP:`), state words and paths stay unchanged. (The Claude-facing
  prompts and the remaining internal modules come in the following phases.)
- **The auto-commit subject for a finished phase is now English: `Phase {id}: {title}`**
  (previously `Fáze {id}: {title}`), to match the translated README. `mini undo` is
  unaffected — it matches the commit via `preSha`, not the subject; no parser depends
  on the subject. Existing Czech `autoCommit.subject` entries in past `state.json`
  stay as archival data.
- **`README.md` and `CHANGELOG.md` translated to English.** Both public docs are now
  fully English, keeping the code blocks, command/flag names, paths, links and the
  Keep a Changelog structure; the README's internal anchor links were updated to the
  new English heading slugs. From now on, new `CHANGELOG.md` entries (phase records via
  `/mini:done`) are written in English — the convention is noted in `CLAUDE.md`.
- **The phase memory (`.mini/memory/phase-XXX.md`) is generated in English.** The
  `buildPhaseMemoryMarkdown` generator now writes English headings (`# Phase`,
  `**Goal:**`, `## Steps`, `## User's note`, `## Auto-commit`, `## Discussion`) and
  the step statuses `done/doing/todo/skipped`. The summary for the `next` prompt
  (`summarizeMemoryForNext`) reads both English and **older Czech** memory (the
  existing archive is not broken). `phase-XXX.json` unchanged.
- **The utility command messages are translated to English.** The runtime output of
  `mini status / undo / init / import-gsd / model / stop / map / audit / update /
  install-commands / migrate / migrate --renumber` is now English (phase labels
  `[done]`/`[doing]`/…, the "Next: …" hints, logs about created/changed files, etc.).
  `mini init` and `mini import-gsd` now create `project.md` with English headings
  (`## What I'm building` / `## Who it's for` / `## Main constraints`); `mini status`
  still reads older Czech project.md too. Command names, flags, `/mini:*` references
  and paths unchanged. (Lifecycle commands, memory/reports and the graph mappers come
  in the following phases.)
- **CLI help and UI messages translated to English.** `mini --help`, command and
  option descriptions, error/validation messages and runtime output (`src/cli.ts`,
  `src/ui/*`) are now English — the tool is aiming at international use. Command names,
  flags, `/mini:*` references and paths stay unchanged. `package.json` `description`
  and the glossary `docs/i18n-glossary.md` (a new CLI/UI terms section) were updated
  too. The language rule in `CLAUDE.md` now says: the whole program is English, only
  the chat and commits stay Czech. (Runtime messages in `commands/*` and other modules
  will be translated in the following phases.)
- **The internal `next`/`plan`/`do` prompts translated to English.** The headless path
  (`mini next/plan/do` via the API) now generates the instructions for Claude in
  English; the response contract (`TITLE:`/`GOAL:`/`STEP:`) stays unchanged. A shared
  translation glossary `docs/i18n-glossary.md` was created as a basis for the next
  phases. (The interactive slash-command path and the shared graph hint will be
  translated in the following phases.)
- **The `audit` and GSD import prompts translated to English.** Audit now generates
  `.mini/codebase.md` with English section headings (Overview / Directory structure /
  Key modules / Technologies); the GSD import has English prose. The machine contracts
  (`NAME:`/`WHAT:`/`FOR_WHOM:`/`CONSTRAINTS:`/`PHASES:` and the status words) stay unchanged.
- **The memory-writing and autonomous (`auto`) run prompts translated to English.**
  The memory prompt and the auto session prompt (and thus the interactive
  `/mini:do` / `/mini:auto`) are now English. The machine contract of the YAML report
  (`phase`/`verdict`/`steps`/`status`/`verify` + their values) stays unchanged.
- **Instruction translation completed — all prompts are English.** The interactive
  session prompts (`/mini:next`, `/mini:plan`, `/mini:done`, `/mini:verify`), the
  `discuss` prompt and the shared graph hint were translated too. The discussion
  notes template and the "Verify findings" section are English and the `last-memory`
  summarizer recognizes them (older Czech memory is still caught). The shared glossary
  is in `docs/i18n-glossary.md`.
- **The `/mini:*` slash-command files translated to English.** The descriptions and
  bodies of the generated `.claude/commands/mini/*.md` (source `install-commands.ts`)
  are now English including the autonomous `auto`. Commands, flags and `$ARGUMENTS`
  unchanged; the CLI logs stayed Czech.
- **`/mini:auto --discuss`** — the flag forces the `discuss` step in every phase of the
  run (analogous to `--verify`). Without it, `discuss` runs only conditionally for hard phases.
- **Verify in the autonomous `/mini:auto`** — the cycle now runs the `verify` step
  between `do` and `done` for **UI/UX phases** (Claude judges from the goal/steps/report).
  A new flag **`--verify`** forces it in every phase. The findings are written into the
  report (and thus into memory) and any problems are fixed within the same phase before closing.

### Changed

- **`mini done` commits the phase in a single commit — nothing dangles in the worktree
  after `done`.** The memory record, the regenerated graph and the final `state.json`
  (the move to `done`) are now created **before** the commit, so `git add -A` picks them
  up into a single phase commit. Previously the commit happened earlier and these artifacts
  dangled until the next phase. `mini undo` identifies the phase commit via `preSha`
  (`HEAD^ === preSha`) instead of its own sha — that one is no longer stored in the
  committed state (it would depend on itself; older phases still have it in `state.json`,
  backward compatibility preserved).
- **`mini verify` / `/mini:verify` is no longer read-only** — after the review it writes
  the findings into the run report (`## Verify findings`), from where they reach memory
  through the report too; for an already closed phase it also appends them directly to the
  memory file. It still does not move the phase state.
- **README unified with the actual state of the tool.** Missing commands were added
  (`mini stop`/`migrate`/`update`) along with the versioning/CHANGELOG/tag for `done`;
  the `.mini/` tree was updated to layout v2 (`phases/`, `graph.json` + `graph/`); the
  memory description was fixed (the `phase-{id}.md` file without a timestamp,
  `last-memory.md` is a short summary, not a symlink).

### Fixed

- **After an npm install, `mini init` creates `.mini/.gitignore`.** The skeleton keeps
  the gitignore under the npm-safe name `gitignore` (no dot) — `npm publish` excludes
  `.gitignore` files from the tarball, so on a fresh machine it was missing from the
  skeleton and `mini init`/`mini update` did not create it in the project. It is still
  written into the project as `.gitignore` (the rename is handled by
  `assets.ts:FILE_RENAMES`).

## [1.4.0] - 2026-05-30

### Added

- **`mini verify` / `/mini:verify`** — an in-depth UI/UX review of the phase by a human.
  Claude interactively guides you through a visual/UX review (sets the scene, goes through
  the `verify` items from the report, adds a broader UX walkthrough and collects findings).
  It targets the current phase, otherwise the last closed one. It is **read-only** — it does
  not move the state, that stays with `done`.
- **`mini stop`** — a cooperative stop of the autonomous `/mini:auto`. It creates the signal
  `.mini/STOP` (from a second terminal); a running `/mini:auto` reads it at the step boundaries,
  finishes the current step, writes a report and exits cleanly. `mini stop --clear` removes the
  signal. Both variants are idempotent.
- **The autonomous `/mini:auto`** — the slash command now completes several phases in a row
  (`next → discuss(conditionally) → plan → do → done → repeat`) with `--max-phases N`
  (default 1) and `--yolo`. It stops and asks at the steps that require a human (`next`,
  `discuss`, the items for manual verification in `done`), and runs quietly for `do` (it does
  not retell the edits). It reads the cooperative stop hooks (`.mini/STOP`) at the step
  boundaries — the signal is created by `mini stop` (see above).
- **`.claude/settings.json`** with an allowlist (`mini:*`, build/test, git), so the
  autonomous run does not bother you with command confirmations.
- **`mini map --file <path>`** — an incremental graph update: it remaps just one file (the
  node `.mini/graph/<path>.md` + the record in `graph.json`, atomically via tmp+rename,
  preserving order) instead of a full rebuild. Can be repeated for several files. A disappeared
  file removes the node and the record; non-mappable extensions and ignored directories are a
  no-op; a missing index falls back to a full build. Because the graph nodes are per-file, the
  result is identical to a full rebuild of the affected file.
- **`mini map --hook`** — for autonomous mode: it reads the edited file path from the PostToolUse
  hook JSON on stdin and remaps it incrementally (no dependency on `jq`). Without a path it
  silently no-ops. The README describes a snippet for `.claude/settings.json` that keeps the
  graph fresh after every `Edit`/`Write`; `mini init` points to it.
- **`/mini:init`** — project initialization directly from Claude Code: the slash command asks in
  the session for four things (name, what you're building, for whom, constraints), saves the
  project via the new non-interactive `mini init --apply --name/--what/--for-whom/--constraints
  [--force]` and, based on the directory content, offers the next steps — for existing code
  `/mini:map` and `/mini:audit`, otherwise `/mini:next`.
- **`/mini:audit`** — a slash command that runs `mini audit` (an overview of the existing
  codebase into `.mini/codebase.md`) directly from Claude Code.

## [1.3.0] - 2026-05-30

### Added

- **`mini update`** — brings the non-generated part of the project up to the current mini
  version: the static `.mini/` skeleton (directories + `.gitignore`) and the slash commands
  `.claude/commands/mini/*.md`. Idempotent — creates the missing, overwrites the changed
  (the skeleton files are mini-owned), leaves the rest unchanged and prints a summary.
  `--dry-run` shows a preview without writing. The skeleton lives as a shipped asset
  (`assets/skeleton/` → `dist/skeleton`) and is the single source of truth: `mini init` draws
  from it too and it is easily extended with more static files.
- **`mini migrate --renumber`** — renumbers the phases to consecutive integers (1..N by their
  order in `state.json`) and unifies the file names in all four directories (`phases/`,
  `discuss/`, `run/`, `memory/`) to the canonical `phase-XXX`. It straightens projects with
  mixed/legacy numbering (e.g. decimal "fix" ids `1.1`…`28.1` next to integers). It handles
  various old name schemes (padded and unpadded, `.prev.md`, memory with a timestamp).
  Idempotent; `--dry-run` shows a preview of the mapping without writing, otherwise it asks for
  confirmation before the change. It leaves orphans (files with no record in the state) alone
  with a warning, and stops on a collision of target names so it overwrites nothing.
- The knowledge graph map now supports **Ruby** (`.rb`): it extracts the imports (`require`
  and `require_relative`, including the parenthesized form) and top-level declarations —
  `def` (with a parameter signature including splat `*`/`**`, keyword `key:`, default values,
  `&block` and endless methods `def x = …`) and the types `class` (kind `class`) and `module`
  (kind `module`). The default visibility is `public`; bare `private`/`protected` and
  `private def …` hide the following members. Visible instance and class methods (`def self.x`)
  and attributes (`attr_reader`/`attr_writer`/`attr_accessor`) are attached to the type with
  line anchors. Comments (`#` and block `=begin`/`=end`) and strings are ignored. The project is
  also recognized by `Gemfile`.
- The knowledge graph map now supports **Swift** (`.swift`): it extracts the imports (including
  submodules `import Foo.Bar` and kinded `import struct Foo.Bar`) and top-level declarations —
  `func` (with a parameter signature, default values, variadics `Int...`, generics,
  `async`/`throws` and `where` clauses) and the types `class`/`struct`/`enum`/`protocol`/
  `extension`/`actor`. The default visibility is `internal`; `private`/`fileprivate` is omitted
  (`private(set)` stays visible). Visible methods are attached to the type with line anchors,
  `static`/`class func` are marked. Comments (including **nested** block comments), doc comments
  and strings (including multiline `"""…"""` and raw `#"…"#`) are correctly ignored. The project
  is also recognized by `Package.swift`.
- The knowledge graph map now supports **Kotlin** (`.kt`/`.kts`): it extracts the imports
  (including wildcard `import a.b.*` and aliases `import a.b.C as D`) and top-level declarations
  — `fun` (with a parameter signature, default values, `vararg`, generics and the extension
  receiver) and the types `class`/`interface`/`object`/`enum class`/`data class`/
  `sealed class|interface`/`annotation class`. The default visibility is `public`;
  `private`/`internal` is omitted. Visible methods are attached to the type with line anchors.
  Comments (including **nested** block comments), KDoc, char literals and strings (including raw
  `"""…"""`) are correctly ignored. The project is also recognized by `build.gradle.kts`.
- The knowledge graph map now supports **C#** (`.cs`): it extracts the usings (`using`,
  `using static`, `global using` and aliases `using Foo = A.B`) and top-level types inside a
  `namespace` (block and file-scoped) — `class`/`struct`/`interface`/`enum`/`record` (including
  `record class`/`record struct`), with `public`/`internal` methods (parameter signatures
  including `params`, default values and `static`) attached to the type and line anchors.
  Comments, XML doc, char literals and strings in all variants (verbatim `@"…"`, interpolated
  `$"…"`, raw `"""…"""`) are correctly ignored. The project is also recognized by
  `*.sln`/`*.csproj`.
- `mini done`/`mini auto`: the `--bump none` option — closes the phase without bumping the
  version (suitable for partial phases, where the version is raised only at the end of the whole unit).
- The knowledge graph map now supports **Java** (`.java`): from the classes it extracts the
  imports (`import`, `import static` and wildcard `import a.b.*`) and top-level types —
  `class`/`interface`/`enum`/`record`/`@interface` declared as `public`/`protected`, with
  `public`/`protected` methods (including parameter signatures, varargs and `static`) attached to
  the type and line anchors. Comments, javadoc, strings and text blocks (`"""…"""`) are correctly
  ignored. The project is also recognized by `pom.xml` or `build.gradle`(`.kts`).
- The knowledge graph map now supports **Go** (`.go`): from the package it extracts the imports
  (single and block `import ( … )` including aliases, `_` blank and `.` dot imports) and
  top-level exports — functions with a signature, `struct`/`interface`, type aliases and
  `const`/`var` (also grouped), exported by the capital initial letter. Methods are attached to
  the receiver type, all with line anchors. The project is also recognized by `go.mod`.

### Changed

- **`mini init`** now creates `.mini/` from the same skeleton as `mini update` (the directories
  `phases/`, `memory/`, `discuss/`, `run/` + `.gitignore`); `project.md` and `state.json` are
  still generated separately.
- **The default behavior of `--bump` is now `none`** (previously `patch`): neither `mini done`
  nor `mini auto` bumps the version in `package.json` by default anymore. To raise it, use
  `--bump patch|minor|major`.
- `--push` now requires an explicit `--bump patch|minor|major` — a push without a version level
  (or with `none`) ends with an error. A push = a release, so it must have a version for the tag.
- **Unified phase file names** across all `.mini/` directories: `discuss/`, `memory/` and `run/`
  now use the same format `phase-XXX` (3 digits with zero padding) as `phases/`. The ISO
  timestamp disappeared from the memory name; a repeated record of the same phase is distinguished
  by the suffix `-2`, `-3`, … instead of the date. Existing files were renamed.

## [1.2.0] - 2026-05-30

### Added

- The knowledge graph map now supports **Python** (`.py`/`.pyi`): from the module it extracts the
  imports (`import`, `from ... import` including relative, aliases, `*` and multiline) and
  top-level exports — functions (`def`/`async def`) with a signature, classes with public methods
  and UPPER_CASE/annotated constants, with line anchors. The project is also recognized by
  `pyproject.toml`/`setup.py`; `.venv/` and `__pycache__/` are ignored.

## [1.1.0] - 2026-05-30

### Added

- `/mini:done` now creates and maintains `CHANGELOG.md` in the Keep a Changelog 1.1.0 format:
  from the report of a finished phase, Claude writes the changes under `## [Unreleased]`
  (the `Added` / `Changed` / `Fixed` sections). On a release with `--bump minor`/`major` and
  `--push`, the content of `## [Unreleased]` is folded into a dated section `## [version] - date`
  (matching the git tag) and a new empty `## [Unreleased]` is inserted on top; patches accumulate
  in `Unreleased` until the next release.
