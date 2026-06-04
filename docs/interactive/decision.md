# `/mini:decision`

> Record the decision (ADR) behind the current phase — on demand.

**CLI variant:** [`mini decision`](../non-interactive/decision.md) — the terminal
command this slash command calls with `--apply` to write the ADR body.

## What it does

`/mini:decision` captures the **why** behind the current phase: a non-trivial
call where a concrete alternative was weighed and rejected, and the choice would
not be obvious from the code later. It is an **on-demand** step — you run it only
when a phase actually hit such a crossroads, before closing the phase with
[`/mini:done`](done.md).

The full ADR drafting instruction lives here (not in the `do`/`done` prompts, so
those stay lean). The regular cycle only points you to this command: both
[`/mini:do`](do.md) and [`/mini:done`](done.md) carry a one-line reminder to run
`/mini:decision` when a real decision was made.

## In a session

1. Claude runs `mini context decision` and judges whether the phase had a real
   crossroads. Most phases have none — then nothing is written.
2. If there was one, Claude drafts a lean ADR (`# title` / `## Decision` /
   `## Why`) and **shows it to you** in the chat for edits/approval — never
   silently.
3. After you approve, Claude writes it with `mini decision --apply`, which targets
   the **current** phase. Run it **before** `/mini:done` so it lands in the phase
   commit.

## Example

```text
You:    /mini:decision
Claude: This phase chose a thin trigger over an always-on ADR block. Draft:

        # Move ADR drafting to an on-demand command
        ## Decision
        The full instruction lives in /mini:decision; do/done only point to it.
        ## Why
        Keeping it in the done prompt cost ~360 tokens every phase, while <5%
        of phases write an ADR.

        Write it?
You:    yes
Claude: [mini decision --apply] Decision record saved for phase 128.
```

## Notes

- The window is between [`/mini:do`](do.md) and [`/mini:done`](done.md):
  `mini decision --apply` rejects an already-closed phase, since the ADR must land
  in that phase's commit.
- In autonomous [`/mini:auto`](auto.md) there is no human to approve, so the ADR
  step simply does not fire — by design.
- The ADR is **not** the CHANGELOG: the CHANGELOG records *what* changed for
  users, the ADR records *why* a technical path was chosen.

## Related

- [`mini decision`](../non-interactive/decision.md) — CLI variant
- [`/mini:do`](do.md) / [`/mini:done`](done.md) — point you here on a crossroads
- [`/mini:status`](status.md) — `--phase <n>` surfaces a phase's ADR
