# mini-orchestrator

[![npm](https://img.shields.io/npm/v/mini-orchestrator)](https://www.npmjs.com/package/mini-orchestrator)
[![node](https://img.shields.io/node/v/mini-orchestrator)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/mini-orchestrator)](LICENSE)

<!-- CI badge temporarily hidden while a GitHub account billing issue is resolved (Actions can't run until then). Re-enable by uncommenting the line below.
[![CI](https://github.com/czsoftcode/mini-orchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/czsoftcode/mini-orchestrator/actions/workflows/ci.yml)
-->

**Keep your AI coding agent on a short leash — one verifiable phase at a time.**

Letting Claude Code loose on a real project usually goes one of two ways: it makes huge, unreviewable changes in a single leap, or it cheerfully agrees with everything you say and praises every idea. Both are how projects quietly go off the rails.

**mini** forces a different rhythm. It breaks work into small phases you approve one by one — *propose → plan → implement → verify* — and keeps the agent focused on the current step instead of rewriting half your codebase. Every phase lives in `.mini/`, so progress is explicit, inspectable, and versioned right next to your code. You stay at the helm at every `done` — and you won't burn through your context window, or your usage limit, on one runaway turn.

It runs **inside your existing Claude Code session** (Pro/Max or API) via native `/mini:*` slash commands — no extra API keys, no separate UI. The CLI command is `mini`; the npm package is `mini-orchestrator`.

**Website:** [miniorchestrator.com](https://miniorchestrator.com)

## See it in action

The whole loop — **init → next → plan → do → done** — in one screen:

<p align="center">
  <img src="https://raw.githubusercontent.com/czsoftcode/mini-orchestrator/main/demo/cycle.gif"
       alt="mini workflow cycle: init, next, plan, do, done — recorded terminal session"
       width="760">
</p>

<sub>The GIF shows the equivalent terminal (CLI) cycle, generated from a real, offline run by [`demo/record.sh`](demo/record.sh) (asciinema → agg). Re-run it to refresh.</sub>

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

## Quick start

Install once:

```bash
npm install -g mini-orchestrator@latest
```

A global install writes the `/mini:*` slash commands into `~/.claude/commands/mini` automatically (see [Installation](#installation) for the details and alternatives). Then, inside any project, drive the whole loop **from your Claude Code session**:

```
/mini:init     # describe the project once (4 questions in the chat)
/mini:next     # let Claude propose the next phase
/mini:plan     # break it into 3–7 concrete steps
/mini:do       # implement this phase — and only this phase
/mini:done     # you verify, then it advances
```

That's the whole loop. You stay in control at every `done`.

<details>
<summary>Walk through your first phase (what you'll actually see in the chat)</summary>

The slash commands run **inside your Claude Code session**, so each one is a short
conversation, not a one-shot CLI print. Here's the shape of the first five minutes.
The snippets are illustrative — **your wording and phases will differ.**

**1. `/mini:init`** — Claude asks four short questions in the chat, then saves the project:

```
You:    /mini:init
Claude: Let's set up the project. A few quick questions:
        1) Project name?            → todo-api
        2) What does it build?      → A small REST API for todos
        3) Who is it for?           → Backend developers
        4) Main constraints?        → Node + TypeScript
        ✓ Project "todo-api" created in .mini/. Next: /mini:next
```

**2. `/mini:next`** — Claude proposes **one** next phase (name + goal) and waits for your OK before saving:

```
You:    /mini:next
Claude: Proposed phase: "Health endpoint"
        Goal: Add GET /health returning {status:"ok"}, covered by a test.
        Save it? (it's small and verifiable)
You:    yes
Claude: ✓ Added: phase 1 — Health endpoint
```

**3. `/mini:plan`** — Claude breaks that phase into 3–7 concrete, verifiable steps:

```
You:    /mini:plan
Claude: Steps for "Health endpoint":
        1. Add the GET /health route → returns 200 with {status:"ok"}
        2. Write a test → vitest covers the route
        Save these? → ✓ Phase 1 broken down into 2 steps.
```

**4. `/mini:do`** — Claude implements **this phase only**, ticking off steps as it goes:

```
You:    /mini:do
Claude: Working phase 1 (Health endpoint)…
        ✓ Add the GET /health route
        ✓ Write a test  (2 passing)
        Report written. Run /mini:done when you've checked it.
```

**5. `/mini:done`** — you're the gate: Claude asks whether it works, then advances the state and commits:

```
You:    /mini:done
Claude: Does phase 1 work as intended?
You:    yes
Claude: ✓ Phase 1 (Health endpoint) done.
        ✓ Commit: Phase 1: Health endpoint
        Run /mini:next for the next phase.
```

From here you repeat **next → plan → do → done** for each phase.

</details>

### Prefer the terminal? The same loop as a CLI

Every step also exists as a plain `mini` command, if you'd rather not run it from inside Claude Code:

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

## Requirements

- [Claude Code](https://claude.com/claude-code) (signed in via Pro/Max or with an API key)
- Node.js 20+

## Installation

```bash
npm install -g mini-orchestrator@latest
```

The command is called `mini`. To update: run the same command again. To uninstall: `npm uninstall -g mini-orchestrator`.

A global install (`npm i -g`) writes the `/mini:*` slash commands into `~/.claude/commands/mini` (user scope, for all projects) automatically — even though npm runs the postinstall hook without a terminal. The status line stays **opt-in**: it is never written into your `~/.claude/settings.json` without a terminal to ask first (an interactive install offers it; an existing `statusLine` is never touched). Enable it anytime with [`mini install-statusline`](docs/non-interactive/install-statusline.md). The postinstall prints a summary of what it created plus a one-line full-removal hint. A local / CI install stays quiet and only prints a hint; run `mini install-commands` there by hand. To remove everything mini added, run [`mini uninstall`](docs/non-interactive/uninstall.md) (then `npm uninstall -g mini-orchestrator`).

<details>
<summary>Try it without touching <code>~/.claude</code> (npx, one-off)</summary>

Want to evaluate mini without a global install? Run it one-off with **npx** (npx ships with npm — it fetches the package into a temporary cache and runs it once, without installing it globally):

```bash
cd your-project
npx mini-orchestrator install-commands   # asks where to put the /mini:* commands: this project or all projects
```

It writes only where you choose and never edits `~/.claude/settings.json` on its own. Pick **this project** to keep everything inside the repo's `.claude/commands/mini`. When you're done evaluating, remove what it added with [`mini uninstall`](docs/non-interactive/uninstall.md).

</details>

<details>
<summary>Installing without <code>sudo</code></summary>

Point the global npm prefix into your home directory (one-off) and have its `bin` on your `PATH`:

```bash
npm config set prefix "$HOME/.local" --location=user   # ~/.local/bin must be on PATH
```

</details>

<details>
<summary>From git / for development</summary>

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

</details>

## How is this different from Claude Code's plan mode?

Claude Code already has a built-in **plan mode**: it drafts a plan, shows it to you, and waits for your approval before editing. It also keeps an in-session todo list while it works. If that already covers what you need, you may not need mini — and that's fine.

The difference is **scope and persistence**. Native plan mode and its todos live inside one conversation: they're in-memory and ephemeral, so when the session ends there's no lasting record of what was done, what's next, or why. mini is the **persistent, multi-session layer** on top of that same idea — it keeps the plan and the progress on disk, next to your code.

| | Native plan mode | mini |
|---|---|---|
| Scope | A single answer / turn | A whole project, phase by phase |
| Persistence | In-memory, per session (ephemeral todos) | On disk in `.mini/`, versioned with your code, resumes across sessions |
| Memory | None | Summaries of completed phases for continuity |
| Git | Manual | Optional auto-commit per phase |
| Autonomy | One plan at a time | `/mini:auto` chains phases with human checkpoints |

**Use native plan mode** for a one-off change you'll finish in a single sitting. **Use mini** when a project spans many sessions and you want the structure — and the record of what was done — to survive between them.

## Commands

Every command comes in **two variants**: the interactive `/mini:*` **slash commands** you run inside a Claude Code session (they drive a short dialog, ask when needed and save the state for you), and the plain `mini *` **terminal commands** that run to completion and are easy to script (the `--apply` forms are what the slash commands call under the hood). The [Quick start](#quick-start) above shows the core `init → next → plan → do → done` loop in both forms.

📖 **The full command reference — every command, both variants, with all flags — lives in [`docs/`](docs/README.md).**

Set up the slash commands once per project with `mini install-commands` (idempotent — just re-run it after upgrading mini). The `.md` command bodies are deliberately thin: each only runs `mini context <cmd>` to print the current prompt, while the **state operations** (`.mini/state.json`, reports, moving phases) happen in the non-interactive `mini … --apply` sub-commands — so the state always stays in tested TypeScript. The CLI and the slash commands are two front-ends over the same core, not a replacement for one another.

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

## Models

Each project picks its Claude model in `.mini/state.json` — a `default` plus optional per-scope overrides (`next`, `plan`, `do`, …):

```bash
mini model show      # current setup
mini model sonnet    # default = sonnet
mini model do opus   # do (the coding session) = opus
```

A good saving combo is `sonnet` as the default with `do` on `opus`. Note that a "cheaper" model doesn't always cost less overall — it often needs more iterations; for real coding (`do`) Opus is usually the most economical anyway. Full flags and scopes: [`mini model`](docs/non-interactive/model.md).

## Status line

mini ships an opt-in Claude Code status line showing the project dir, model, and context-window usage (plus a `↑ <version>` hint when a newer mini is out):

```
mini · Opus 4.8 · 1M ▰▰▰▱▱▱▱▱▱▱ 28%
```

It is never forced and an existing status line is never touched. Enable it with [`mini install-statusline`](docs/non-interactive/install-statusline.md), which also documents the gauge anatomy and the background version-check refresh.

## What gets sent to Claude

`mini do` typically sends ~600-1000 tokens (1 page of `project.md` + the current phase + 5 steps). No history of old phases, no old plans, no verification reports.

If Claude needs to understand the existing code, **it reads the files itself** via `Read`/`Glob`/`Grep` — that is cheaper than loading everything into context up front.

After every Claude call (next/plan/import-gsd) you'll see its cost:

```
  (20.4k tokens · 5 output · 14.1k from cache · ~$0.028 in API)
```

## Machine-readable project map (graph)

`mini map` builds a **machine-readable map** of the project — a lightweight index `.mini/graph.json` plus a per-file node `.mini/graph/<path>.md` (imports, exports and signatures, with `@L<start>-<end>` line anchors). It lets Claude **navigate without reading whole files**: find a symbol in the index, the lines in the node, then read just that section. Both files are derivations of the sources (gitignored) and can be regenerated anytime.

For incremental remaps (`mini map --file …`) and the PostToolUse hook that keeps the graph fresh in autonomous mode, see [`mini map`](docs/non-interactive/map.md).

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
    ├── graph.json                       # lightweight index of the machine-readable map (see above)
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

`mini auto` runs the phase loop on its own — for each phase it goes `next → plan → do → done` and continues with the next, **without asking** along the way (Claude runs with `--permission-mode acceptEdits`: Edit/Write without asking, Bash still asks). It is **not** fully unattended: it always stops at the human verification in `done` — that's your checkpoint. The one-session-per-phase rationale, the report contract, and the 3-pass retry live in [`mini auto`](docs/non-interactive/auto.md) (or [`/mini:auto`](docs/interactive/auto.md) for the in-session variant).

## Import from GSD

mini started as a lighter-weight alternative to [GSD](https://github.com/gsd-build/get-shit-done): instead of a pile of regenerated markdown files (`RESEARCH.md`, `PLAN.md`, …) read over and over, mini keeps a **minimal state** (a one-page `project.md` plus a lightweight `state.json` header). If you have a GSD project in `.planning/`, bring it over with `mini import-gsd` (or the `/mini:import-gsd` slash command) — it imports only the skeleton (phases + statuses) and leaves the `.planning/` files untouched. Details: [`mini import-gsd`](docs/non-interactive/import-gsd.md).

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

## License

Released under the [MIT License](./LICENSE) — © 2026 Stanislav Kremeň. Free to
use, modify and distribute; keep the copyright and license notice. Built in
collaboration with Claude Code.
