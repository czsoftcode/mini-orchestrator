# mini-orchestrator — command reference

Mini is an orchestrator on top of Claude Code: it keeps the project state in
`.mini/` and feeds Claude only the essentials for each step. Every user-facing
command comes in **two variants**, and this reference documents both:

- **Interactive** — the `/mini:*` slash commands you run **inside a Claude Code
  session**. They drive a dialog: Claude reads the current context, asks you
  questions when needed, and saves the state for you. See
  [`interactive/`](interactive/).
- **Non-interactive** — the `mini *` commands you run **in a terminal**. They
  run to completion without a dialog and are easy to script. The `--apply`
  forms are what the slash commands call under the hood. See
  [`non-interactive/`](non-interactive/).

> One command has only a single page: [`mini stop`](non-interactive/stop.md) is
> console-only (it signals a running autonomous run to stop) and has no
> `/mini:stop` slash variant.

Each page links to its sibling variant and to related commands.

## Project setup

| Command | Interactive | Non-interactive |
| --- | --- | --- |
| Create a new project | [`/mini:init`](interactive/init.md) | [`mini init`](non-interactive/init.md) |
| Regenerate the project graph | [`/mini:map`](interactive/map.md) | [`mini map`](non-interactive/map.md) |
| Overview of an existing codebase | [`/mini:audit`](interactive/audit.md) | [`mini audit`](non-interactive/audit.md) |

## The phase loop

| Command | Interactive | Non-interactive |
| --- | --- | --- |
| Propose the next phase | [`/mini:next`](interactive/next.md) | [`mini next`](non-interactive/next.md) |
| Discuss the phase intent | [`/mini:discuss`](interactive/discuss.md) | [`mini discuss`](non-interactive/discuss.md) |
| Break the phase into steps | [`/mini:plan`](interactive/plan.md) | [`mini plan`](non-interactive/plan.md) |
| Implement the phase | [`/mini:do`](interactive/do.md) | [`mini do`](non-interactive/do.md) |
| In-depth UI/UX review | [`/mini:verify`](interactive/verify.md) | [`mini verify`](non-interactive/verify.md) |
| Verify and move the state | [`/mini:done`](interactive/done.md) | [`mini done`](non-interactive/done.md) |

## The autonomous loop

| Command | Interactive | Non-interactive |
| --- | --- | --- |
| Chain whole phases on its own | [`/mini:auto`](interactive/auto.md) | [`mini auto`](non-interactive/auto.md) |
| Signal an autonomous run to stop | — | [`mini stop`](non-interactive/stop.md) |

## State & control

| Command | Interactive | Non-interactive |
| --- | --- | --- |
| Project phase overview | [`/mini:status`](interactive/status.md) | [`mini status`](non-interactive/status.md) |
| Revert the last state change | [`/mini:undo`](interactive/undo.md) | [`mini undo`](non-interactive/undo.md) |
| View or set the Claude model | [`/mini:model`](interactive/model.md) | [`mini model`](non-interactive/model.md) |
| Archive of future ideas | [`/mini:todo`](interactive/todo.md) | [`mini todo`](non-interactive/todo.md) |
| Show the CHANGELOG | [`/mini:changelog`](interactive/changelog.md) | [`mini changelog`](non-interactive/changelog.md) |
| Health check of the setup | [`/mini:doctor`](interactive/doctor.md) | [`mini doctor`](non-interactive/doctor.md) |
| Update mini itself | [`/mini:upgrade`](interactive/upgrade.md) | [`mini upgrade`](non-interactive/upgrade.md) |
