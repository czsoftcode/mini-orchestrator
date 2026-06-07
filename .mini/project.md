# mini orchestrator over Claude Code

## What I'm building
A phase-by-phase orchestrator for Claude Code that keeps a project's plan, current phase and progress on disk in `.mini/`, so the work survives across many sessions.

## Who it's for
A solo developer using Claude Code (Pro/Max or API).

## Approach
- Small, human-approved phases are the means; durable memory across sessions is the goal. When the two conflict, continuity of context wins.
- `.mini/` on disk is the single source of truth — plan, current phase and summaries of completed phases — versioned with the code, so a developer can resume after days without re-reading old chat.
- The loop is propose -> plan -> implement -> verify, with a human checkpoint at every `done`; the agent stays focused on the current phase only.
- Lives inside the existing Claude Code session via `/mini:*` slash commands, mirrored by a `mini` CLI for terminal / non-interactive use.

## Non-goals
- Do not add a custom UI or web dashboard outside the Claude Code session in this version — mini stays inside the session plus the CLI.
- Do not support agents other than Claude Code (no Cursor, Aider or raw OpenAI) in this version.
- Do not build LLM / API-key management in this version — rely on what the user already has in Claude Code.
- Do not add team / multi-user or cloud state sync in this version — `.mini/` stays local and git-versioned; conflicts are resolved by git, not mini.

## Success criteria
- A developer can close the project and, days later, reopen it and have mini restore from `.mini/` where they left off and why — without reading the old chat.
- Every phase is independently verifiable and reversible via git / undo.

## Main constraints
TypeScript. Runs inside an existing Claude Code session via native `/mini:*` commands (mirrored by a `mini` CLI) — no extra API keys and no separate UI.
