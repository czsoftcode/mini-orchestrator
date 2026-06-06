# Phase 139 — Demo script: slash-command flow

**Goal:** Rewrite demo/cycle.sh to portray the interactive /mini:* slash-command dialog (a scripted You:/Claude: exchange per step, clearly labelled illustrative) instead of the CLI cycle, kept offline and deterministic; re-rendering cycle.gif via record.sh stays a manual step the user runs.

## Steps
- [done] Add You/Claude dialog helpers
- [done] Rewrite cycle as slash-command exchange
- [done] Update record.sh + script header
- [done] Fix README GIF caption
- [done] Run cycle.sh offline & verify

## Auto-commit
- Phase 139: Demo script: slash-command flow

## Run report
---
phase: 139
verdict: done
steps:
  - title: "Add You/Claude dialog helpers"
    status: done
  - title: "Rewrite cycle as slash-command exchange"
    status: done
  - title: "Update record.sh + script header"
    status: done
  - title: "Fix README GIF caption"
    status: done
  - title: "Run cycle.sh offline & verify"
    status: done
verify:
  - title: "Re-render demo/cycle.gif from the new script"
    detail: "Run `bash demo/record.sh` in a real terminal (needs asciinema + agg, a TTY) and visually check the GIF: dialog legibility at 92x30, that the ✦ Claude prose reads as scripted/illustrative and not as a fixed Claude transcript, and that nothing overflows the frame. I cannot render the GIF here (asciinema needs a pty) and cannot judge the visual result."
---

# Phase 139 — report from the auto session

## What was done
Rewrote `demo/cycle.sh` from a CLI-command walkthrough into an **interactive
`/mini:*` slash-command dialog**, kept fully offline and deterministic:

- New helpers `you "…"` (the human's prompt line, `> `) and `claude "…"` (an
  `✦ Claude` reply header + indented prose). `run "…"` still executes the real
  `mini … --apply` sub-command, so every `[ok] …` line is genuine tool output —
  only Claude's prose is scripted.
- Each cycle step is now a `You: /mini:* → Claude: short reply → real [ok]`
  exchange (init → next → plan → do → done), matching how a slash command works
  under the hood (it calls the same `--apply` sub-command).
- An explicit header disclaimer marks Claude's replies as scripted/illustrative
  and the `[ok]` lines as real.

Docs aligned so nothing claims the old CLI flow:
- `cycle.sh` header comment rewritten.
- `record.sh` needed **no change** — it had no "CLI" wording; its asciinema
  title ("mini — the workflow cycle") and render mechanics stay correct.
- README: the GIF `alt`, the `<sub>` caption, **and** the `<details>` fallback
  transcript were all switched to the slash-command flow. The fallback is
  labelled "The same flow as a text transcript", so I updated it too (was a CLI
  transcript) to keep that claim truthful — it now mirrors the dialog.

## Verified mechanically
- `TYPE_DELAY=0 PROMPT_PAUSE=0 bash demo/cycle.sh` runs offline with no live API
  call, prints the dialog plus real `[ok]` output for all five steps, and exits
  `0`.

## Decision worth noting (no ADR needed)
We deliberately chose a **scripted dialog with real `[ok]` output** over (a) a
live recorded session (non-deterministic, not reproducible from `record.sh`,
costs an API call) and (b) keeping the CLI GIF and only relabelling it. This was
discussed and decided with the user before planning. The honesty risk (a faked
Claude transcript) is mitigated by the explicit disclaimer + keeping the tool
output genuine. Not a hidden crossroads — captured here, no separate ADR.

## Open / manual
- The actual `cycle.gif` is **not** re-rendered — that needs a TTY (asciinema)
  which isn't available here. The user runs `bash demo/record.sh` and eyeballs
  the result (see `verify`).
