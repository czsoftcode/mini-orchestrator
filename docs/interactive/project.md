# `/mini:project`

> Shape the project's vision — a plan-before-code session that enriches the
> existing `project.md` with Approach, Non-goals and Success criteria.

**CLI variant:** [`mini project`](../non-interactive/project.md) — the terminal
command this slash command builds on (interactive, or `--apply` to save a
contract from stdin).

## What it does

`/mini:project` runs **after** [`/mini:init`](init.md). Init records a terse
`project.md` (what you build / who it's for / constraints); `/mini:project` keeps
those and **adds** the steering sections that tell the agent *how* to approach the
work and *where not to go*:

- **Approach** — the strategy and the main flows/data/screens, distilled.
- **Non-goals** — what is deliberately left out, phrased as rules.
- **Success criteria** — how you'll know it's done and good.

`project.md` stays a **one-page steering doc**: only the main points from the
conversation are written, not a full spec. It enriches an existing project — it
does **not** create one (run [`/mini:init`](init.md) first).

## In a session

Claude runs a short plan-before-code interview, one small batch of questions at a
time, staying critical (pros/cons + an alternative for each real choice):

1. **Frame & remove assumptions** — reflects back the current `project.md`, then
   asks about users, the core workflow, the data and the screens.
2. **Draft a rough plan** — main user + job, 3–5 core flows, key data, main
   screens, the risky unhappy paths; weighs the trade-offs.
3. **Non-goals & guardrails** — turns the "not building yet" list into rules, and
   flags what it would be tempted to add that you didn't ask for.
4. **Final check & success** — asks the questions that could derail the project,
   agrees the success criteria, shows the full draft for approval.

After you approve, it saves via the contract (`mini project --apply`, heredoc),
keeping the existing name / target user / constraints. It writes **only**
`project.md` — never the phase state.

## Example

```text
You:    /mini:project
Claude: Right now project.md says: a CLI orchestrator for Claude Code, for
        developers, in TypeScript. Before I propose an approach — who runs it,
        and what's the single job they need done first?
You:    …
Claude: [a few batches later] Here's the full draft project.md … approve?
You:    yes
Claude: [runs mini project --apply <<'EOF' … EOF] Updated .mini/project.md.
        Next: /mini:next to propose a phase.
```

## Related

- [`/mini:init`](init.md) — create the project first
- [`mini project`](../non-interactive/project.md) — CLI variant
- [`/mini:next`](next.md) — propose the next phase
