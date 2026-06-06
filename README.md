# mini-orchestrator

[![npm](https://img.shields.io/npm/v/mini-orchestrator)](https://www.npmjs.com/package/mini-orchestrator)
[![node](https://img.shields.io/node/v/mini-orchestrator)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/mini-orchestrator)](LICENSE)

**Keep your AI coding agent on a short leash — one verifiable phase at a time.**

Letting Claude Code loose on a real project usually goes one of two ways: it makes huge, unreviewable changes in a single leap, or it cheerfully agrees with everything you say and praises every idea. Both are how projects quietly go off the rails.

**mini** forces a different rhythm. It breaks work into small phases you approve one by one — *propose → plan → implement → verify* — and keeps the agent focused on the current step instead of rewriting half your codebase. Every phase lives in `.mini/`, so progress is explicit, inspectable, and versioned right next to your code ([what's in there](docs/files.md)). You stay at the helm at every `done` — and you won't burn through your context window, or your usage limit, on one runaway turn.

It runs **inside your existing Claude Code session** (Pro/Max or API) via native `/mini:*` slash commands — no extra API keys, no separate UI. The CLI command is `mini`; the npm package is `mini-orchestrator`.

**Website:** [miniorchestrator.com](https://miniorchestrator.com)

**Documentation:** the full command reference — every command in both the interactive `/mini:*` and terminal `mini` variants, with all flags — lives in [`docs/`](docs/README.md).

## See it in action

The whole loop — **init → next → plan → do → done** — in one screen:

<p align="center">
  <img src="https://raw.githubusercontent.com/czsoftcode/mini-orchestrator/main/demo/cycle.gif"
       alt="mini inside Claude Code: the /mini:init → next → plan → do → done slash-command flow"
       width="760">
</p>

<sub>The GIF shows the `/mini:*` slash-command flow inside a Claude Code session, generated from a real, offline run by [`demo/record.sh`](demo/record.sh) (asciinema → agg). The `[ok]` lines are real mini output. Re-run it to refresh.</sub>

Image not loading? The same flow, step by step as text, is in the [Quick start walkthrough](#quick-start) below.

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

## Commands

Every command comes in **two variants**: the interactive `/mini:*` **slash commands** you run inside a Claude Code session (they drive a short dialog, ask when needed and save the state for you), and the plain `mini *` **terminal commands** that run to completion and are easy to script (the `--apply` forms are what the slash commands call under the hood). The [Quick start](#quick-start) above shows the core `init → next → plan → do → done` loop in both forms.

📖 **Browse the per-command pages — each documents both variants and all flags — in [`docs/`](docs/README.md).**

Set up the slash commands once per project with `mini install-commands` (idempotent — just re-run it after upgrading mini). The `.md` command bodies are deliberately thin: each only runs `mini context <cmd>` to print the current prompt, while the **state operations** (`.mini/state.json`, reports, moving phases) happen in the non-interactive `mini … --apply` sub-commands — so the state always stays in tested TypeScript. The CLI and the slash commands are two front-ends over the same core, not a replacement for one another.

### Autonomous mode

Instead of running each step yourself, let mini **chain whole phases**. It goes through the cycle (`next → plan → do → done`, with `discuss`/`verify` when a phase needs them) and continues with the next — semi-autonomously. It runs with `--permission-mode acceptEdits` (Edit/Write happen without asking, but **Bash still asks** — no surprise `rm -rf`), and it always stops at the human checkpoints: your phase idea in `next` and the manual verification in `done`. Halt a running loop cleanly with [`mini stop`](docs/non-interactive/stop.md).

Two paths, same idea: [`/mini:auto`](docs/interactive/auto.md) drives it from inside one Claude Code session; the CLI [`mini auto`](docs/non-interactive/auto.md) runs Claude as a subprocess. Both pages document all flags (`--max-phases`, `--yolo`, `--verify`, `--discuss`, `--bump`/`--push`).

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

mini stays frugal with context: `mini do` sends only **roughly 600–1000 tokens** (1 page of `project.md` + the current phase + its steps) — no history of old phases, plans or reports. When Claude needs the existing code, **it reads the files itself** via `Read`/`Glob`/`Grep`. Details and the per-call cost line: [`docs/context.md`](docs/context.md).

mini can also build a **machine-readable map** of the project (`mini map`) — a lightweight index plus per-file nodes with line anchors — so Claude navigates to the right lines instead of reading whole files. See [`mini map`](docs/non-interactive/map.md).

## Import from GSD

mini started as a lighter-weight alternative to [GSD](https://github.com/gsd-build/get-shit-done) — minimal state instead of a pile of regenerated markdown files. Already have a GSD project in `.planning/`? Bring over its phase skeleton with `mini import-gsd` (leaves the `.planning/` files untouched). Details: [`mini import-gsd`](docs/non-interactive/import-gsd.md).

## FAQ

**Why does Claude Code ask for permission every time?**
In `mini do` the classic permission mode is the default (you click on every Edit/Bash). In `mini auto`, `acceptEdits` is used — Edit/Write no longer ask, but Bash still does (no random `rm -rf`).

**Can I pause and come back tomorrow?**
Yes. The state is in `.mini/state.json`, you can commit it to git or put it on the cloud. `mini status` tells you where you left off.

**Does it commit after a phase?**
When `mini done` (or `mini auto`) finalizes a phase, it runs `git add -A && git commit` with the message `Phase {id}: {title}`. Pushing is never automatic — you get a `git push` hint to run yourself. Version bumps and tags are opt-in via `--bump`/`--push`.

**Does it work with an API key instead of Pro/Max?**
Yes, `mini` just runs `claude` as a subprocess — authentication is handled by Claude Code itself, based on how it's configured.

More — version bump/CHANGELOG/tag details, memory records, undo after a commit — in the [FAQ](docs/faq.md).

## License

Released under the [MIT License](./LICENSE) — © 2026 Stanislav Kremeň. Free to
use, modify and distribute; keep the copyright and license notice. Built in
collaboration with Claude Code.
