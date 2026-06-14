# `/mini:next`

> Propose and save the next project phase.

**CLI variant:** [`mini next`](../non-interactive/next.md) — saves a phase from
`--title`/`--goal`; this slash command does the proposing first.

**Argument hint:** `[optional phase idea]`

## What it does

`/mini:next` proposes **one** next phase — small and verifiable (1–3 days) — and,
after you approve, saves it as the current phase. You can pass your own idea as
an argument; otherwise Claude looks at the progress so far, the
[todo](todo.md) backlog and any open [adversarial findings](../non-interactive/findings.md)
and sketches candidates.

Open findings from the red-team review ([`/mini:adversarial`](../non-interactive/findings.md))
surface as candidate **fix phases** — Claude lists each one (`id · severity ·
where — title`) and may propose a phase that addresses it. Unlike todo items there
is no auto-tick: there is no `--from-finding` flag, so a finding stays listed
until it is resolved by hand.

## In a session

1. Claude reads the project and phase history. If you gave an idea, it starts
   from that; otherwise it proposes 2–3 candidates and recommends one.
2. It shows the proposed phase (short title + a one-sentence goal).
3. After you approve, it saves with `mini next --apply --title … --goal …` and
   tells you to continue with [`/mini:discuss`](discuss.md) or
   [`/mini:plan`](plan.md). If the phase came from a [todo](todo.md) backlog
   item, it adds `--from-todo <n>` so that item is ticked off automatically.

## Example

```text
You:    /mini:next add pagination to the todos endpoint
Claude: Proposed phase: "Pagination for /todos" — GET /todos accepts ?page and
        ?limit and returns a paged result, covered by a test. Save it?
You:    yes
Claude: [runs mini next --apply …] Saved phase 12. Next: /mini:plan.
```

## Related

- [`mini next`](../non-interactive/next.md) — CLI variant
- [`/mini:todo`](todo.md) — idea backlog that feeds proposals
- [`/mini:plan`](plan.md) — break the saved phase into steps
