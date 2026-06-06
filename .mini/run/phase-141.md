---
phase: 141
verdict: done
steps:
  - title: "Write the consolidated Autonomous mode section"
    status: done
  - title: "Remove the standalone ## Auto mode section"
    status: done
  - title: "Verify links and length"
    status: done
---

# Phase 141 — report from the auto session

Auto mode is now described in exactly one place in the README.

- **`### Autonomous /mini:auto` (the 13-line flag reference under Commands)** was replaced with a ~2-paragraph "Autonomous mode" summary: what auto does (chains the cycle, `acceptEdits` with **Bash still asking**, stops at the `next`/`done` human checkpoints, `mini stop` to halt) plus the slash-vs-CLI distinction. The per-flag list (`--max-phases`, `--yolo`, `--verify`, `--discuss`, `--bump`/`--push`) was dropped — it is already fully documented in both `docs/interactive/auto.md` and `docs/non-interactive/auto.md`, which the section now links to.
- **The standalone `## Auto mode` section near the end** (the CLI `mini auto` paragraph that duplicated the same acceptEdits/checkpoint description) was removed entirely.

Kept the security-relevant detail inline as agreed: the one sentence that **Bash still asks** under `acceptEdits`, so `--yolo`/auto behaviour isn't a surprise.

**Verified mechanically:** README 352 → 340 lines (−12). The three docs links resolve (`docs/interactive/auto.md`, `docs/non-interactive/auto.md`, `docs/non-interactive/stop.md`). No stale `#auto-mode` anchor, no leftover `(below)` cross-reference, no duplicate auto heading, no double blank lines. Only README.md changed — no typecheck/tests relevant.

No real rejected alternative here, so no ADR.

**Campaign status:** README is now 340 lines (started at 396). Remaining: B2 (What gets sent → docs/context.md), B3 (Machine-readable map trim), B6 (GSD), B7 (Workflow tips), then C (reorder + duplicate transcript) and A (cleanups incl. the agreed CI-comment removal).
