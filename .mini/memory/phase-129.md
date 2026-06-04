# Phase 129 — Mark ADR phases in status

**Goal:** In the mini status overview, flag each phase that carries a decision record (ADR) with a compact, TTY-safe marker, gathered via a single readdir of .mini/decisions/ (no per-phase JSON reads) and exposed as hasDecision in --json. Add a shared listDecisionPhaseIds helper to decisionStore.

## Steps
- [done] listDecisionPhaseIds helper in decisionStore
- [done] Read the ADR id set once in status()
- [done] Render a compact ADR marker in the overview
- [done] Expose hasDecision in --json
- [done] Update docs for the ADR marker

## Auto-commit
- Phase 129: Mark ADR phases in status

## Run report
---
phase: 129
verdict: done
steps:
  - title: "listDecisionPhaseIds helper in decisionStore"
    status: done
  - title: "Read the ADR id set once in status()"
    status: done
  - title: "Render a compact ADR marker in the overview"
    status: done
  - title: "Expose hasDecision in --json"
    status: done
  - title: "Update docs for the ADR marker"
    status: done
---

# Phase 129 — report from the auto session

All five steps done; full suite green (924 tests) and `tsc --noEmit` clean.

## What was built

- **`listDecisionPhaseIds(cwd)`** in `decisionStore.ts` — a single `readdir` of
  `.mini/decisions/`, parsing `phase-<id>.md` names back to numeric ids via the
  regex `^phase-(\d+(?:\.\d+)?)\.md$` (handles zero-padded ids and dotted
  subphases). Missing dir → empty set, never an error. Non-matching files
  ignored. 4 new unit tests.
- **`status()`** now loads the id set once (added to the existing `Promise.all`)
  and threads it to both the overview renderer and `buildStatusJson` — no
  per-phase reads, as required by the goal.
- **Overview marker** — `printPhase` appends a dim `✎ ADR` tag (constant
  `ADR_MARKER`) after the title for any phase in the set. Picocolors strips color
  outside a TTY, so it renders as plain ` ✎ ADR` in tests/pipes.
- **`hasDecision: boolean`** added to `StatusJsonPhase`; `buildStatusJson` takes
  an optional `decisionIds` set (defaults to empty, so existing callers/tests
  keep working) and sets the flag per phase.
- **Docs** — `docs/non-interactive/status.md` (overview marker + `hasDecision`
  field + example), `docs/interactive/status.md`, and the README command table.

## Verification

Mechanically verified myself on this very repo (which has `.mini/decisions/phase-126.md`
and `phase-127.md`):

- `node dist/cli.js status` → phases 126/127 show `✎ ADR`, 125/128 do not.
- `node dist/cli.js status --json` → only 126/127 have `hasDecision: true`.

Note: the global `mini` binary still runs the *old* installed build — verify with
`node dist/cli.js …` after `npm run build`, not bare `mini`. Nothing for a human
to check.

## Notes / one snag

- First overview test failed because a test phase title literally contained the
  substring "ADR" ("No ADR phase") — renamed the fixtures to "Plain phase" /
  "Decided phase". A reminder that the marker is matched as a substring; if a real
  phase title ever contains "✎ ADR" verbatim a `--json` consumer should rely on
  `hasDecision`, not on scraping the text line (which is what `--json` is for).
- No real design crossroads here — the marker form and the shared-helper location
  were settled during plan/discuss. No `/mini:decision` needed.
