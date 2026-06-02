# Changelog

All notable changes to this project are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

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
