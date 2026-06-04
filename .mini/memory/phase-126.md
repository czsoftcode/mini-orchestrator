# Phase 126 — Decisions storage + status detail

**Goal:** Introduce a .mini/decisions/ folder holding one lightweight markdown per phase (phase-XXX.md: heading + Decision + Why), with a pure helper to read a phase's decision file, and surface an existing ADR in 'mini status --phase <n>'. The file's existence is the single source of truth — no flag in state.json or phase-XXX.json. Unit-tested; collection in /mini:done, overview marking, doctor orphan check and undo handling are follow-up phases.

## Steps
- [done] decisionStore module + unit tests
- [done] Surface ADR in status --phase text
- [done] Surface ADR in status --phase --json
- [done] Define lightweight format + docs

## Auto-commit
- Phase 126: Decisions storage + status detail

## Run report
---
phase: 126
verdict: done
steps:
  - title: "decisionStore module + unit tests"
    status: done
  - title: "Surface ADR in status --phase text"
    status: done
  - title: "Surface ADR in status --phase --json"
    status: done
  - title: "Define lightweight format + docs"
    status: done
---

# Phase 126 — report from the auto session

## What was delivered

A read-only foundation for lightweight decision records (ADRs). The *why* behind
a phase can now live in `.mini/decisions/phase-<id>.md` and is surfaced in the
single-phase view. Writing the files (collection via `/mini:done`), the overview
marker, the doctor orphan-check and `undo` handling are deliberately out of
scope — follow-up phases.

- **`src/state/decisionStore.ts`** mirrors `runReport.ts`: `DECISIONS_DIR`
  (`.mini/decisions`), `decisionPath`, `decisionExists`, `readDecision`. The
  reader returns the raw markdown or `null` (absent / empty / whitespace-only),
  strips a BOM and normalizes CRLF. **The file's existence is the only source of
  truth — no flag anywhere**, so there is nothing to keep in sync and `undo`
  will just remove/restore the file. Unit-tested (path padding, absent file,
  read, BOM/CRLF, whitespace-only).
- **`mini status --phase <n>`** now loads the decision and renders it under a
  `Decision:` heading when present (raw markdown, like a run report body),
  nothing otherwise. `renderPhaseDetail` and `buildPhaseDetailJson` gained a
  trailing `decision` parameter (defaulted, so existing callers/tests are
  unaffected); the JSON object carries `decision: string | null`. Covered by
  unit tests (with/without ADR) and an end-to-end integration test that writes a
  real file and checks both text and `--json`.
- **Docs** — `docs/non-interactive/status.md` gained a "Decision records"
  section documenting the convention (single source of truth = file existence,
  heading + Decision + Why, max one decision per phase, no `NNNN-` numbering),
  plus the updated `--phase` description, the `decision` JSON field, an example
  and a `jq` line.

## Verification

- Full suite green: 71 files / 899 tests; typecheck and lint clean.
- Built `dist/` and smoke-tested `mini status --phase 125` with a temporary
  `.mini/decisions/phase-125.md` — the `Decision:` block renders in text and the
  `decision` field is populated in `--json`. Temp file removed afterwards.

## Notes / decisions worth recording

- **No flag in state, file existence is the truth.** This was the explicit
  design call (discussed with the user): a boolean in `state.json`/`phase-*.json`
  would duplicate the file's existence and create a sync surface. The overview
  marker (a follow-up) can still be cheap via one `readdir` of `.mini/decisions/`
  — no per-phase JSON reads.
- **The reader does not parse `Decision`/`Why`.** The structure is a convention
  for the writer, not a contract for the reader; the display just renders raw
  markdown. Keeps the reader trivial and tolerant of freeform notes.
- **Language:** new code/comments/docs in English, matching CLAUDE.md and the
  recent phase 125 code (the Czech JSDoc in `runReport.ts` is legacy, not the
  current convention). Note: the auto-memory `feedback_language_czech` says
  comments should be Czech, which contradicts the checked-in CLAUDE.md and recent
  code — worth reconciling with the user.

## Open questions for the follow-up phases

- Collection in `/mini:done`: agent drafts an ADR from what happened, human
  approves/edits; nothing written when there was no real crossroads.
- Overview marker in `mini status` (e.g. a `✎` per phase with an ADR).
- `doctor` orphan-check (decision file with no matching phase — same pattern as
  the phase-125 stale-run-reports check).
- `mini undo` must remove/restore the decision file to stay consistent.
