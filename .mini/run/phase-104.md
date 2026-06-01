---
phase: 104
verdict: done
steps:
  - title: "Duration formatter + helper"
    status: done
  - title: "Show duration in the phase line"
    status: done
  - title: "CHANGELOG"
    status: done
---

# Phase 104 — report from the auto session

`mini status` now shows how long each finished phase took (todo item 9).

## What was done
- **Pure helpers** in `status.ts`: `formatDuration(ms)` (two largest non-zero
  units — `45s`, `3m`, `2h 5m`, `1d 2h`; clamps sub-second/negative to `0s`) and
  `phaseDuration(phase)` (ms from `startedAt`..`completedAt`, `null` when not both
  present or end < start). Unit tests over the ranges and the null cases.
- **`printPhase`** appends a dim `(took <dur>)` to the phase line when the
  duration is known; running/unstarted phases show nothing.
- **CHANGELOG** `Added` entry.

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**827 tests**).
- Visual check: `mini status` shows `(took 4m 20s)` / `(took 4m 24s)` on recent
  done phases and nothing on the in-progress phase.
