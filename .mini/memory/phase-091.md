# Phase 91 — Sdílená instrukce o paralelismu

**Goal:** Přidat kanonickou sdílenou instrukci (po vzoru GRAPH_USAGE_HINT) o paralelismu tool-callů a vložit ji do relevantních lifecycle promptů: (1) křehké/stavové příkazy pouštět samostatně — hlavně cokoli se serverem (start/stop, kill, pkill, věci na pozadí), ne v jedné dávce s užitečnou prací; (2) nezávislé čtení a dotazy klidně paralelně; (3) závislé kroky sekvenčně — když je potřeba výstup jednoho příkazu pro druhý.

## Steps
- [done] Sdílená konstanta PARALLELISM_HINT
- [done] Vložit hint do do promptu
- [done] Vložit hint do auto promptu
- [done] Obnovit snapshoty + test konstanty
- [done] README + CHANGELOG

## Auto-commit
- Phase 91: Sdílená instrukce o paralelismu

## Run report
---
phase: 91
verdict: done
steps:
  - title: "Sdílená konstanta PARALLELISM_HINT"
    status: done
  - title: "Vložit hint do do promptu"
    status: done
  - title: "Vložit hint do auto promptu"
    status: done
  - title: "Obnovit snapshoty + test konstanty"
    status: done
  - title: "README + CHANGELOG"
    status: done
---

# Phase 91 — report from the auto session

Added a shared parallelism instruction for tool calls, mirroring the existing
`GRAPH_USAGE_HINT` pattern.

## What was done
- **`src/prompts/parallelismHint.ts`** — new file exporting `PARALLELISM_HINT`,
  a tight English constant with three points: (1) run fragile/stateful commands
  on their own (servers: start/stop, kill, pkill, background jobs), never batched
  with other work; (2) parallelize independent reads/queries; (3) keep dependent
  steps sequential. The file header documents *why* it lives only in execution
  prompts and not in next/discuss/plan (mirrors the reasoning in `graphHint.ts`).
- **`doPhase.ts`** — `buildDoPhasePrompt` renders the hint in `# Your task`,
  right after the task line and before "Read the files yourself".
- **`autoPhase.ts`** — `buildAutoPhasePrompt` renders the same constant in
  `# Your task`, before the progress-tracking block.
- **Snapshots** — `vitest -u` refreshed the doPhase + autoPhase prompt
  snapshots. Full suite green: 58 files / 724 tests.
- **CHANGELOG.md** — new entry under `[Unreleased] / Added`.

## Notes
- No dedicated unit test for the constant — same as `GRAPH_USAGE_HINT`, it is
  covered indirectly through the prompt snapshots.
- No README change: README does not document the internal shared hints, so a
  mention there would not fit (the graph hint isn't documented there either).
- `npm run build` (tsc) passes — the new `.js` import resolves cleanly.
