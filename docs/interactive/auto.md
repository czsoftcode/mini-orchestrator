# `/mini:auto`

> Autonomous mode — completes several phases in a row.

**CLI variant:** [`mini auto`](../non-interactive/auto.md) — the scriptable entry
point with the version switches; this slash command runs the full loop in the
session.

**Argument hint:** `[--max-phases N] [--yolo] [--verify] [--discuss] [--bump <level>] [--push]`

## What it does

`/mini:auto` runs the whole phase cycle on its own —
`next → discuss(conditionally) → plan → do → verify(conditionally) → done` — and
continues into the next phase, until it hits a run boundary. It is **not** fully
unattended: it stops and asks you at `next` (it won't invent phases blindly) and
at any manual-verification (verify) item.

## Arguments

| Switch | Meaning |
| --- | --- |
| `--max-phases N` | How many phases at most to complete in a row (**default 1**). |
| `--yolo` | Fully unattended — only effective when the session runs in `acceptEdits`. |
| `--verify` | Force the verify step in **every** phase (not just UI/UX ones). |
| `--discuss` | Force the discuss step in **every** phase. |
| `--bump <level>` | Version bump when closing **each** phase: `patch` \| `minor` \| `major` (default: none). |
| `--push` | Push after each phase. Requires an explicit `--bump patch \| minor \| major`. |

## In a session

1. Claude announces, once, how many phases it will run and which switches are on.
2. For each phase it walks the cycle, reporting progress briefly without flooding
   the chat.
3. It stops cleanly at a boundary: the phase limit, a finished project, a
   blocker, or a cooperative stop signal from [`mini stop`](../non-interactive/stop.md).

## Example

```text
You:    /mini:auto --max-phases 3 --bump patch
Claude: Running up to 3 phases, bump=patch. Phase 1: I need your idea for the
        next phase… [proceeds through next → plan → do → done, then repeats]
```

## Notes

- `--yolo` only suppresses prompts when the session is in `acceptEdits`; the
  slash command itself doesn't turn off confirmation.
- To halt a running auto, run [`mini stop`](../non-interactive/stop.md) from
  another terminal — it stops at the next checkpoint.

## Related

- [`mini auto`](../non-interactive/auto.md) — CLI variant
- [`mini stop`](../non-interactive/stop.md) — signal it to stop
- [`/mini:done`](done.md) — how each phase is closed
