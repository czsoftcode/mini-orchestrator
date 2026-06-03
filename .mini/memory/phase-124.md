# Phase 124 — mini status --phase <n>

**Goal:** mini status --phase <n> prints a detailed view of one phase: title, goal, status, duration, every step with its detail and status, and the phase run report (verdict, verify items, free-text body); an unknown <n> fails with a clean error. Works with --json too (the single phase, with run report body). Verifiable via tests.

## Steps
- [done] Pure renderer renderPhaseDetail
- [done] status --phase <n>: human view
- [done] --json --phase <n>: single-phase detail
- [done] Docs

## Auto-commit
- Phase 124: mini status --phase <n>

## Run report
---
phase: 124
verdict: done
steps:
  - title: "Pure renderer renderPhaseDetail"
    status: done
  - title: "status --phase <n>: human view"
    status: done
  - title: "--json --phase <n>: single-phase detail"
    status: done
  - title: "Docs"
    status: done
---

# Phase 124 — report from the auto session

## What was delivered

`mini status --phase <n>` now zooms in on a single phase instead of the whole
overview — in both the human and `--json` forms.

- **`renderPhaseDetail(phase, summary, isCurrent)`** (pure) in
  `src/commands/status.ts` — returns the lines for the detail view: phase header
  (status, id, title, duration), goal, every step **with its `detail`** and
  status, and — when a run report exists — the verdict, items pending manual
  verification, and the free-text body. TTY-free, so it's unit-tested directly.
- **`status({ phase })`** — new `showPhaseDetail` branch looks the phase up
  (unknown id → `log.warn` + exit code 1, or a `{ error: 'no-such-phase' }` JSON
  object), reads the run report tolerantly via `readRunReportSummary` (never
  crashes on a stale report) and prints the detail.
- **`buildPhaseDetailJson(phase, summary, isCurrent)`** (pure) — the
  `--phase <n> --json` object: `id`, `title`, `goal`, `status`, `isCurrent`,
  timestamps, `durationMs`, `steps` (incl. `detail`) and `runReport`
  (`verdict`, `unparseable`, `verify`, optional `body`) or `null`.
- **Run report body**: extended the tolerant `summarizeRunReportText` /
  `RunReportSummary` with an optional `body` field (free text under the YAML),
  so the detail view can show the human notes without the hard-validating
  `readRunReport`. The status overview ignores the new field — no behavior
  change there.
- **CLI**: `--phase <n>` option on `mini status`; a non-numeric value is
  rejected up front (exit 1). Phase ids may be fractional (subphases like 2.1),
  so it parses with `Number`, not integer-only.
- **Docs**: `docs/non-interactive/status.md` — synopsis, description, options
  table, JSON shape and a worked human + `--json` example.

## Verification (all mechanical, done here)

- `npm run typecheck` — clean.
- `npm test` — 884 passed (added unit tests for `renderPhaseDetail`,
  `buildPhaseDetailJson`, the `summarizeRunReportText` body capture, and a
  filesystem integration block for `status({ phase })` covering unknown-id
  (human + json), and an existing phase in both forms).
- `npm run build` — clean.
- **End-to-end** via the built `dist/cli.js` on this project:
  `status --phase 123` shows the full detail incl. steps with detail and the run
  report body; `status --phase 124 --json` emits the single-phase object with
  step detail and `runReport: null` (the report didn't exist yet at that moment);
  `--phase 999` → clean warning + exit 1; `--phase abc` → invalid-value error +
  exit 1.

## Notes

- No deviations from the plan. The run-report body plumbing wasn't a separate
  step but was the natural prerequisite for "run report (… body)" in step 1, so
  it landed there.
