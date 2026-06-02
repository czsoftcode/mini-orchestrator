# mini

A minimalist CLI orchestrator built on top of **Claude Code**. It keeps the project state, sends Claude only the essentials, and uses your Pro/Max subscription (no API keys).

**Website:** [miniorchestrator.com](https://miniorchestrator.com)

It was created as a simpler alternative to [GSD](https://github.com/gsd-build/get-shit-done), which consumes too many tokens — it generates a pile of MD files (`RESEARCH.md`, `PLAN.md`, `VERIFICATION.md`, …) and reads them repeatedly. `mini` keeps a **minimal state** (a one-page `project.md` + a lightweight `state.json` header with phase detail in `.mini/phases/`) and sends Claude typically 1 page + the current task.

## Requirements

- [Claude Code](https://claude.com/claude-code) (signed in via Pro/Max or with an API key)
- Node.js 20+

## Try it without touching `~/.claude`

Want to evaluate mini without a global install? Run it one-off with **npx** (npx ships with npm — it fetches the package into a temporary cache and runs it once, without installing it globally):

```bash
cd your-project
npx mini-orchestrator install-commands   # asks where to put the /mini:* commands: this project or all projects
```

It writes only where you choose and never edits `~/.claude/settings.json` on its own. Pick **this project** to keep everything inside the repo's `.claude/commands/mini`. When you're done evaluating, remove what it added with [`mini uninstall`](docs/non-interactive/uninstall.md).

## Installation

```bash
npm install -g mini-orchestrator@latest
```

The command is called `mini`. To update: run the same command again. To uninstall: `npm uninstall -g mini-orchestrator`.

A global install (`npm i -g`) writes the `/mini:*` slash commands into `~/.claude/commands/mini` (user scope, for all projects) automatically — even though npm runs the postinstall hook without a terminal. The status line stays **opt-in**: it is never written into your `~/.claude/settings.json` without a terminal to ask first (an interactive install offers it; an existing `statusLine` is never touched). Enable it anytime with [`mini install-statusline`](docs/non-interactive/install-statusline.md). The postinstall prints a summary of what it created plus a one-line full-removal hint. A local / CI install stays quiet and only prints a hint; run `mini install-commands` there by hand. To remove everything mini added, run [`mini uninstall`](docs/non-interactive/uninstall.md) (then `npm uninstall -g mini-orchestrator`).

Installing without `sudo`: point the global npm prefix into your home directory (one-off) and have its `bin` on your `PATH`:

```bash
npm config set prefix "$HOME/.local" --location=user   # ~/.local/bin must be on PATH
```

### From git / for development

```bash
git clone https://github.com/czsoftcode/mini-orchestrator.git
cd mini-orchestrator
npm install
npm run build
node dist/cli.js --help        # or: alias mini='node $(pwd)/dist/cli.js'
```

To install your local build onto your `PATH` (the same layout Claude Code uses), run:

```bash
npm run install-local
```

It builds the project and installs it under `~/.local`:

- `~/.local/bin/mini` → symlink to the built CLI
- `~/.local/share/mini/versions/<version>/` → the package's own files and production deps

Older versions are kept around so you can roll back — delete them manually if they get in the way. Make sure `~/.local/bin` is on your `PATH`, then verify with `mini --version`.

## Quick start

The whole loop — **init → next → plan → do → done** — in one screen:

<p align="center">
  <img src="https://raw.githubusercontent.com/czsoftcode/mini-orchestrator/main/demo/cycle.gif"
       alt="mini workflow cycle: init, next, plan, do, done — recorded terminal session"
       width="760">
</p>

<sub>The GIF is generated from a real, offline run by [`demo/record.sh`](demo/record.sh) (asciinema → agg). Re-run it to refresh.</sub>

<details>
<summary>Image not loading? The same cycle as a text transcript</summary>

```console
$ mini init --apply --name "todo-api" --what "A small REST API for todos" --for-whom "Backend developers" --constraints "Node + TypeScript"
[ok] Project "todo-api" created in .mini/

# Claude proposes the next phase
$ mini next --apply --title "Health endpoint" --goal "Add GET /health returning {status:ok} with a test"
[ok] Added: phase 1 — Health endpoint

# break it into concrete, verifiable steps
$ printf '%s\n' "Add the route :: GET /health returns 200 JSON" "Write a test :: vitest covers it" | mini plan --apply
[ok] Phase 1 broken down into 2 steps.

# work the phase — normally "mini do" opens an interactive Claude session
$ mini do --apply
[ok] Phase 1 (Health endpoint) marked as in progress.
$ mini do --apply --step-done "Add the route"
$ mini do --apply --step-done "Write a test"

# close it — verify, write a memory note, commit
$ mini done --apply
[ok] Phase 1 (Health endpoint) done.
[ok] Commit: Phase 1: Health endpoint
```

</details>

```bash
mkdir my-project && cd my-project

mini init        # 4 questions → creates .mini/project.md and .mini/state.json
mini next        # Claude proposes the first phase
mini do          # starts a Claude Code session on the phase
                 # … you work in Claude … /exit
mini done        # "does it work?" → moves the state forward
mini next        # next phase …
```

Or the shortcut:

```bash
mini auto        # next → plan → do (with acceptEdits) → done; everything without asking except the final "does it work?"
```

## Commands

| Command | What it does |
|--------|---------|
| `mini init` | Creates a new project (project.md + empty state). In a brownfield directory it offers to run `mini audit` at the end. |
| `mini next` | Claude proposes the next phase |
| `mini audit` | Goes through the existing code and creates/updates `.mini/codebase.md` (a project overview for later Claude sessions) |
| `mini map` | Regenerates the machine-readable project map (`.mini/graph.json` + `.mini/graph/`). With `--file <path>` it remaps just one file (can be repeated); with `--hook` it reads the path from the hook JSON on stdin — see [Machine-readable project map](#machine-readable-project-map-graph) |
| `mini discuss` | Optional discussion of the current phase before planning — Claude saves a summary into `.mini/discuss/phase-{id}.md`, which `plan` and `do` then use as context |
| `mini plan` | Claude breaks the current phase down into 3-7 steps |
| `mini do` | Builds the prompt, shows it to you, starts an interactive Claude Code |
| `mini done` | Human verification ("does it work?"), moves the state, finds the next phase; after finishing a phase it optionally bumps the version in the place that fits the project's language (a `VERSION` file as fallback) and folds `CHANGELOG.md`, automatically commits the work to git (default `--bump none`, with `--push` also a tag `v<version>`) and writes a memory record (`.mini/memory/phase-{id}.md`) |
| `mini verify` | Opens an interactive Claude Code session for the in-depth UI/UX review of the phase by a human (symmetric to `mini discuss`, the terminal counterpart of `/mini:verify`) — Claude guides you through a visual/UX review (based on the report's `verify` items) and writes the findings into the report (and, for a closed phase, into memory); it does not move the phase state. It targets the current phase, otherwise the last closed one |
| `mini auto` | Chain: next → plan → do (acceptEdits) → done, everything without asking except done |
| `mini status` | What the project is, where we are, models, phases and steps. `--json` prints a machine-readable object (title, models, currentPhaseId, open-idea count, phases with timestamps/durationMs/steps) for scripts |
| `mini changelog [version]` | Shows the project's `CHANGELOG.md` changes: by default the latest released version's section, a `<version>` argument for a specific version, `--all` for the whole history, `--unreleased` for the pending section |
| `mini doctor` | Health check of the project setup: state and schema version, `project.md`/`CHANGELOG.md` presence, installed slash-command count and mini version freshness — each line ok/warn/fail with a fix hint. Read-only |
| `mini todo` | Archive of future ideas and changes (`.mini/todo.md`, a markdown checklist). `mini todo` lists the items; `add "<text>"` appends one; `edit <n> "<text>"` rewrites one; `done <n>` / `remove <n>` act on the listed number; `clear` drops all done items. `mini next` offers the open items as candidate phase ideas — and, when it proposes its own ideas, offers to stash the extras back into the archive. `/mini:todo suggest` has Claude propose a batch of ideas and write them straight in (no phase needed). The open-idea count also shows in `mini status` |
| `mini undo` | Reverts the last state change (1 step back, no deep history); if `mini done` auto-committed in the last step and HEAD still sits on a clean tree, it also offers to revert the commit (`git reset --soft`). `--dry-run` previews without changing anything, `--yes` skips the confirmation (used by `/mini:undo`) |
| `mini stop` | Creates a cooperative stop signal `.mini/STOP` for the autonomous `/mini:auto` (typically from a second terminal); `--clear` removes it — see [Autonomous `/mini:auto`](#autonomous-miniauto) |
| `mini model …` | Per-project / per-scope model choice (see below) |
| `mini import-gsd` | One-off import of an in-progress GSD project from `.planning/`. Bare, it reads `.planning/` (via a Claude call) and saves a mini project. For the `/mini:import-gsd` slash command it also exposes `--prompt` (print the extraction prompt) and `--apply` (read the extraction response from stdin and save, preserving phase statuses; `--force` overwrites an existing project) |
| `mini migrate` | One-off conversion of the old monolithic `state.json` to the v2 layout (lightweight header + `.mini/phases/`); with `--renumber` it renumbers phases to consecutive numbers and unifies file names |
| `mini update` | Alias for `mini upgrade` — typing `mini update` checks npm for a newer `mini-orchestrator` and installs it, so a slip of the tongue does the expected thing. Accepts the same `--check` / `--yes` flags. (To refresh a project's generated `.mini/` skeleton + slash commands, use `mini install-commands`.) |
| `mini upgrade` | Checks npm for a newer `mini-orchestrator` and installs it (`npm install -g mini-orchestrator@latest`); reports current → latest and asks first. `--check` only reports, `--yes` installs without asking. A status-line indicator (`↑ <version>`) also signals when a newer version is available — see [Status line](#status-line) |
| `mini install-commands` | Generates `.claude/commands/mini/*.md` (the `/mini:*` slash commands) into the project — see below |
| `mini context <cmd>` | Prints the current session prompt for a cycle step (`next`/`discuss`/`plan`/`do`/`done`/`verify`) to stdout; called by the slash commands |
| `mini statusline` | Renders the mini status line for Claude Code (reads the status JSON on stdin) — wired into `settings.json`, not run by hand; see below |

## mini commands directly in Claude Code

The whole cycle `next → discuss → plan → do → done` can also be run **directly from Claude Code** via the native slash commands, without spawning a nested Claude inside the session.

```bash
mini install-commands     # one-off in the target project
```

This creates `.claude/commands/mini/{init,next,discuss,plan,do,done,verify,status,todo,changelog,doctor,map,audit,auto,undo,model,upgrade}.md`. Then in Claude Code:

```
/mini:init           # creates the project (questions in the chat) → offers /mini:map and /mini:audit
/mini:next [idea]    # proposes and saves the next phase
/mini:discuss        # discusses the phase, saves notes
/mini:plan           # breaks the phase into steps
/mini:do             # implements the phase and writes a report
/mini:done           # human verification in the chat → moves the state
/mini:verify         # in-depth UI/UX review of the phase by a human; writes findings into the report (and memory)
/mini:auto [args]    # autonomous mode: completes several phases in a row (--max-phases N, --yolo, --verify, --discuss, --bump <level>, --push)
/mini:map            # regenerates the project graph
/mini:status         # overview of the phases (read-only)
/mini:todo [args]    # ideas/changes archive: list, add <text>, edit <n> <text>, done <n>, remove <n>, clear, suggest
/mini:changelog      # show CHANGELOG.md changes (<version> | --all | --unreleased)
/mini:doctor         # health check of the project setup (read-only)
/mini:audit          # overview of the existing codebase into .mini/codebase.md
/mini:undo           # reverts the last state change (preview → confirm in the chat → apply)
/mini:model [args]   # views/sets the project model (show | reset | <scope> <model>)
/mini:upgrade        # checks npm for a newer mini and installs it (preview → confirm in the chat → apply)
```

`/mini:undo` and `/mini:model` are the non-interactive counterparts of the interactive terminal commands `mini undo` / `mini model`: undo previews the change (`mini undo --dry-run`), confirms in the chat and applies it (`mini undo --yes`); model leans on the non-interactive sub-commands (`mini model show` / `<scope> <model>` / `reset`) — neither blocks on a TTY prompt in the Claude Code Bash.

### Autonomous `/mini:auto`

`/mini:auto` goes through the whole phase cycle (`next → discuss(conditionally) → plan → do → verify(conditionally) → done`) and after finishing one phase smoothly continues with the next — **semi-autonomously**:

- **`--max-phases N`** (default 1) — how many phases at most to complete in a row; `--yolo` = a run without unnecessary asking (works only in a session started with `--permission-mode acceptEdits`).
- **`--verify`** — forces the `verify` step in every phase. Without it, auto runs `verify` only for **UI/UX phases** (judged from the goal/steps/report): it guides a human through an in-depth review between `do` and `done`, writes the findings into the report (and thus into memory) and fixes any problems within the same phase before closing.
- **`--discuss`** — forces the `discuss` step in every phase. Without it, auto runs `discuss` only for **hard phases** (an ambiguous goal, multiple directions).
- **`--bump <level>`** / **`--push`** — passed on to `mini done --apply` when closing **each** phase: `--bump patch | minor | major` bumps the version (default: no bump), `--push` pushes to the remote after the commit. As with `mini done`, `--push` requires an explicit `--bump` (on its own, or with `--bump none`, nothing is pushed).
- **Stops and asks** at the steps where a human is needed: `next` (takes your phase idea), `discuss` (for hard phases or with `--discuss`), `verify` (UI/UX review) and at the items for **manual verification** in `done`.
- **Quiet run for `do`** — it does not retell every edit into the chat, just briefly reports progress.
- **Cooperative stop:** at the step boundaries it checks the stop signal (`.mini/STOP`) and finishes cleanly; for a hard interrupt mid-step use Esc/Ctrl+C. You create the signal with `mini stop` (from a second terminal), remove it with `mini stop --clear`.

Note: this is the slash variant driven by Claude in a single session. The CLI `mini auto` (below) is a separate path that runs Claude as a subprocess and completes **one** phase.

How it works: the `.md` command body is thin — it just runs `mini context <cmd>`, which always prints the current prompt including the project context. The agentic work is done by Claude in the running session; the **state operations** (`.mini/state.json`, reports, moving the phase) are performed by the non-interactive sub-commands `mini … --apply`, so the state stays in tested TS. `install-commands` is idempotent — run it again after updating mini. The CLI `mini …` via the terminal stays unchanged; the slash commands are an add-on, not a replacement.

## Models

Configured per project in `.mini/state.json`. Can be set separately for `next`, `plan`, `do`, `importGsd`, `audit`, `memory`, or jointly via `default`.

```bash
mini model                       # interactively (scope → model)
mini model show                  # a table of the current settings
mini model sonnet                # default = sonnet
mini model do opus               # do (Claude session) = opus
mini model plan haiku            # plan = haiku
mini model do default            # clears the override (inherits default)
mini model reset                 # clears everything
```

**Recommended combination for saving:**
```bash
mini model sonnet                # default = sonnet for light things
mini model do opus               # do = opus for complex coding
```

## Status line

mini ships its own Claude Code status line. It shows, on one line:

```
mini · Opus 4.8 · 1M ▰▰▰▱▱▱▱▱▱▱ 28%
```

— the (shortened) project directory, the model with its version, the
context-window size (`200k`/`1M`), and a gauge plus percentage of the
**context-window usage** (recovered from the session transcript, since Claude
Code does not report token counts to the status line directly).

When a newer mini version is available on npm, a yellow `↑ <version>` segment is
appended at the end:

```
mini · Opus 4.8 · 1M ▰▰▰▱▱▱▱▱▱▱ 28% · ↑ 1.9.1
```

The status line never blocks on the network for this: it reads a small cached
reading of the latest published version (in the OS temp dir) and fires a detached
background refresh to update it for next time. The refresh runs **on every new
Claude Code session** (detected via the session id in the status payload), so you
get a fresh check each time you start Claude; within a single long-running session
it then refreshes again only once the cache is older than **5 hours** (a short
retry cooldown keeps a failing fetch from re-firing on every render). Run
`mini upgrade` to install the new version (or `mini upgrade --check` to just see
what's available).

**Install:** on `npm install` the postinstall hook offers it — but only when you
have **no** status line configured yet. In an interactive install it asks first;
a global install (`npm i -g`) sets it up without asking, since it runs without a
terminal. Either way it is never forced and an existing status line (yours,
GSD's, Claude's) is never touched. It writes a single `statusLine` entry into
`~/.claude/settings.json`:

```json
{
  "statusLine": { "type": "command", "command": "node \"…/mini/dist/cli.js\" statusline" }
}
```

**Disable:** remove the `statusLine` block from `~/.claude/settings.json`.

The renderer is the `mini statusline` command (reads the status JSON on stdin);
you normally never run it by hand — Claude Code calls it on every refresh.

**Note:** a "cheaper" model does not always mean saving on the Pro/Max limit. Cheaper models often need more iterations → a larger total token consumption. For `do` (real coding), Opus is usually the most economical anyway.

After every Claude call (next/plan/import-gsd) you'll see:

```
  (20.4k tokens · 5 output · 14.1k from cache · ~$0.028 in API)
```

## What gets sent to Claude

`mini do` typically sends ~600-1000 tokens (1 page of `project.md` + the current phase + 5 steps). No history of old phases, no old plans, no verification reports.

If Claude needs to understand the existing code, **it reads the files itself** via `Read`/`Glob`/`Grep` — that is cheaper than loading everything into context up front.

## Machine-readable project map (graph)

`mini map` goes through the source files and creates a **machine-readable map** of the project:

- `.mini/graph.json` — a lightweight index: for each file its path, its node and the export names,
- `.mini/graph/<path>.md` — a node per file: imports, exports and signatures with anchors to lines (`@L<start>-<end>`).

It helps Claude **navigate without reading whole files**: from the index it finds where a symbol is, from the node which lines, and only then reads just that section. Both files are derivations of the source files (gitignored) — they can be regenerated anytime.

### Incremental update (`--file`)

A full `mini map` remaps the whole tree. For narrow changes there is an incremental path that touches **only one node**:

```bash
mini map --file src/foo.ts          # remaps only src/foo.ts (node + index record)
mini map --file a.ts --file b.ts    # several files at once
```

Because the graph nodes are purely per-file (no back edges), the result is identical to a full rebuild of the affected file — just much faster. When `graph.json` does not exist yet, `--file` falls back to a full build. Non-mappable extensions and ignored directories (`node_modules`, `dist`, …) are a no-op; when a source file has disappeared in the meantime, its node is removed too.

### Auto-update after an edit (hook)

For **autonomous mode** it pays off to keep the graph fresh after every edit. A PostToolUse hook does that — after every `Edit`/`Write` it remaps just the affected file (a local operation, no tokens). Add this to the `.claude/settings.json` of the target project:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "mini map --hook >/dev/null 2>&1 || true" }
        ]
      }
    ]
  }
}
```

`mini map --hook` reads the edited file path from the hook JSON on stdin itself (no dependency on `jq`); `>/dev/null 2>&1 || true` keeps the hook quiet and non-blocking even without `mini` installed. The hook does not catch file deletions and renames (via the shell) — for those occasionally run a full `mini map` as a reconciliation.

## Files in the project

```
my-project/
└── .mini/
    ├── project.md                       # 1 page — what you're building, for whom, constraints
    ├── codebase.md                      # overview of the existing code (created/updated by `mini audit`)
    ├── state.json                       # lightweight header: phase index, statuses, models (layout v2)
    ├── state.prev.json                  # header backup for `mini undo` (only 1 step back)
    ├── phases/
    │   └── phase-{id}.json              # detail of one phase — steps, report, verify (layout v2)
    ├── graph.json                       # lightweight index of the machine-readable map (see below)
    ├── graph/
    │   └── <path>.md                    # map node per file — imports, exports, signatures
    ├── last-memory.md                   # short summary of the latest memory record (input of the `next` prompt)
    ├── discuss/
    │   └── phase-{id}.md                # optional notes from `mini discuss` (Intent / Key decisions / Watch out for)
    ├── run/
    │   └── phase-{id}.md                # report from `mini auto` (YAML statuses + free text)
    └── memory/
        └── phase-{id}.md                # summary of a finished phase (What was done / Key decisions / Loose ends)
```

`state.json` is only a **lightweight header** (phase index, statuses, models); the detail of each phase (steps, report, verify) lives separately in `.mini/phases/phase-{id}.json`. `mini undo` backs up both (`state.prev.json` + `phases-prev/`). `graph.json` + `graph/` are derivations of the source files (gitignored) — `mini map` regenerates them anytime. The autonomous `/mini:auto` additionally reads the stop signal `.mini/STOP` (created by `mini stop`).

You can edit `project.md` by hand. The state is better changed via the mini commands than by editing the JSON by hand. The files in `discuss/` are free markdown notes — you can edit or delete them at will; `plan` and `do` read them if they exist, otherwise they simply skip them. The files in `run/` are written by Claude at the end of every auto session — `done` reads the step statuses from them (see [Auto mode](#auto-mode)).

`codebase.md` (optional, created by `mini audit`) is a technical overview of the project — directory structure, key modules, technologies. No prompt injects it automatically; Claude reads it itself in `do`/`plan`/`next` sessions via `Read`, instead of going through `src/` again every time. `mini audit` keeps the manual notes in it. Run it ad hoc, whenever it feels stale.

The files in `.mini/memory/` (`phase-{id}.md`, with a discriminator `phase-{id}-2.md`, `-3`, … on a repeated `done` of the same phase) are written at the end of `mini done` (and `mini auto`) after finalizing the phase as `done`. By default `mini` assembles them directly in TypeScript from the phase data (metadata + the verbatim content of the discuss and run report) — without calling the Claude API; it uses a short print-mode Claude session only when the `memory` scope is explicitly set (`mini model memory …`). They complement `git log` with a layer you won't find there — **why** solution X was chosen over Y, what loose ends remained, what to watch out for in the next phases. Memory records are append-only and `mini undo` does not touch them. `last-memory.md` holds a **short summary** of the latest record (read by the `next` prompt). For a `skipped` phase, memory is not written. The file is created **outside the commit** — when you want it versioned, commit it by hand.

## Auto mode

`mini auto` automates one phase:

1. `[1/4]` Proposes the next phase (or continues an in-progress one) — without asking
2. `[2/4]` Breaks it into steps (or skips if it already has steps) — without asking
3. `[3/4]` Starts Claude Code with `--permission-mode acceptEdits` (Edit/Write without asking, Bash still asks) — without asking
4. `[4/4]` Verification: asks **you** whether it works

Auto **always** ends at the human verification in `done` — that's your checkpoint.

### One Claude session for the whole phase

Unlike the interactive `mini do` (which you start manually for one step), auto runs **one Claude session for the whole phase**. The reason: every Claude restart means re-exploring the project (Read/Glob, loading context) with no added value.

Before the session ends, Claude writes a report into `.mini/run/phase-{id}.md`. The report has two parts:

- **YAML front matter** with the step statuses (`done` / `skipped` / `blocked` / `todo`) and the overall phase verdict (`done` / `partial` / `blocked`) — `done({auto})` moves the state in `state.json` from it.
- **Free text** below the YAML block — a short summary for you (what went well, what Claude ran into, open questions).

If unclosed steps remain after the session (Claude didn't finish, or the report is missing), auto runs another attempt — **at most 3 passes** in total. The second and third attempt get a link to the backed-up report (`phase-{id}.prev.md`) in the prompt, so Claude knows where the previous attempt ended. After exhausting the limit, auto finishes with a warning and hands the baton to you.

When a Claude session ends without a report (a crash, `--max-turns`, a manual `/exit` without writing), auto won't blindly mark anything — it drops into the interactive `done` and asks you per step.

The reports in `.mini/run/` stay as history after the phase is finalized — you can read them back later.

## Import from GSD

In a directory with `.planning/`:

```bash
mini import-gsd
```

Claude reads `PROJECT.md` and the roadmap, creates `.mini/project.md` and `.mini/state.json`. It imports only the skeleton — phases + statuses. The detailed MD files in `.planning/` stay, but `mini` ignores them.

You can also run it **from Claude Code** with the `/mini:import-gsd` slash command: the session reads `.planning/` itself (no nested Claude) and saves via `mini import-gsd --apply`, asking before it overwrites an existing project.

## FAQ

**Why does Claude Code ask for permission every time?**
In `mini do` the classic permission mode is the default (you click on every Edit/Bash). In `mini auto`, `acceptEdits` is used — Edit/Write no longer ask, but Bash still does (no random `rm -rf`).

**What if I want to do a phase, but not the way Claude proposed it?**
`mini next` → "Edit and add" → you edit the title and goal by hand. Or you add it to `state.json` by hand.

**What if a phase is "done" but has todo steps?**
`mini done` → "Mark the phase as done" → the remaining steps are marked `skipped` and it moves to the next phase.

**Can I pause and come back tomorrow?**
Yes. The state is in `.mini/state.json`, you can commit it to git or put it on the cloud. `mini status` tells you where you left off.

**Commit and push after a phase?**
When `mini done` (or `mini auto`) finalizes a phase as `done`, it automatically runs `git add -A && git commit` with the message `Phase {id}: {title}` (optionally with a body from the note). If the cwd is not a git repo, there is nothing to commit, or the commit fails (e.g. a pre-commit hook), it continues and you finish the commit by hand. The push is never done automatically — after the commit you'll see a `git push` hint that you run yourself.

**Version bump, CHANGELOG and tag?**
By default `done` does **not** bump the version (`--bump none`). With `--bump patch|minor|major` it raises it before the commit and, for `minor`/`major`, folds the `## [Unreleased]` section in `CHANGELOG.md` into a dated version (patches accumulate). The version is written to **the place that matches the project's language**, with sources tried in a fixed priority (the first one carrying a version wins): `package.json` → `Cargo.toml` (`[package]`) → `pyproject.toml` (`[project]`/`[tool.poetry]`) → `setup.py` → `composer.json` (only when a `version` field is already present) → `__version__ = "x.y.z"` → a language-agnostic `VERSION` file. When no manifest carries a version, `VERSION` is used and, if missing, created with `0.1.0`. `--push` additionally pushes after the commit and creates a git tag `v<version>` (read from the same source) — that's why `--push` requires an explicit `--bump` (without it the tag would have no new version). Everything is opt-in: without flags, done just commits the phase work.

**Memory record after a phase?**
After finalizing a phase as `done` (and after the auto-commit), `.mini/memory/phase-{id}.md` is written with a summary of **what was done / key decisions / loose ends**, and its short summary for the `next` prompt goes into `last-memory.md`. By default memory is assembled directly in `mini` without calling Claude (free and instant); a Claude print-mode session is used only when the `memory` scope is explicitly set. Memory is nice-to-have — when the write fails, a warning is printed and the workflow continues. When you turn on the `memory` scope, we recommend a cheaper model (`mini model memory haiku`), because it runs after every finished phase.

**Undo after the auto-commit?**
`mini undo` remembers the pre-commit HEAD of the last auto-committed phase (in `state.json` at `phase.autoCommit`). When you call `mini undo` after `mini done`, it offers — alongside reverting state.json — a `git reset --soft` back to the previous commit, but only if HEAD still sits on the auto-commit and the working tree is clean. If you committed something else in the meantime or have uncommitted changes, undo reverts only `state.json` and prints a hint on how to drop the commit by hand.

**Does it work with an API key instead of Pro/Max?**
Yes, `mini` just runs `claude` as a subprocess — authentication is handled by Claude Code itself, based on how it's configured.

## Workflow tips

- Start with `mini auto` for the first 1-2 phases to see how it suits you
- Then switch between `mini auto` (fast) and the classic `mini do` (control)
- If Claude proposes nonsense in `mini next` in auto, **press Ctrl+C** and run without auto
- After every phase, `mini status` shows the overall progress

## Support

mini is free and open source. If it saves you time, you can support its
development through [**GitHub Sponsors**](https://github.com/sponsors/czsoftcode)
— or just use the **Sponsor** button at the top of the repository. Every bit
helps keep the project moving, one small phase at a time. 🙏

## License

Released under the [MIT License](./LICENSE) — © 2026 Stanislav Kremeň. Free to
use, modify and distribute; keep the copyright and license notice. Built in
collaboration with Claude Code.
