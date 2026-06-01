---
phase: 105
verdict: done
steps:
  - title: "JSON status builder"
    status: done
  - title: "--json flag wiring"
    status: done
  - title: "README and CHANGELOG"
    status: done
---

# Phase 105 — report from the auto session

Machine-readable `mini status --json` (todo item 8, the last open one).

## What was done
- **Pure `buildStatusJson(projectMd, state, openTodos)`** in `status.ts` →
  `{title, what, models, currentPhaseId, ideasOpen, phases:[{id, title, status,
  startedAt?, completedAt?, durationMs?, steps:[{title,status}]}]}`. Reuses
  `phaseDuration`; `durationMs` is omitted when timestamps are incomplete. Unit
  tests (fields, phase mapping, JSON-serializability).
- **`status({json})`** prints `JSON.stringify(..., null, 2)` and returns early
  (no decoration / hints); a missing project prints `{"error":"no-project"}`.
  `--json` registered in `cli.ts`. The open-todo count is now computed once and
  shared by both paths.
- **Docs**: README `mini status` row + CHANGELOG `Added` entry.

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**831 tests**).
- Smoke test: `mini status --json` on this project parses as valid JSON, exposes
  all keys, lists 105 phases, and omits `durationMs` for the in-progress phase.
