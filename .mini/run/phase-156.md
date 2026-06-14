---
phase: 156
verdict: done
steps:
  - title: "reviewedAt in findings store + tests"
    status: done
  - title: "Stamp baseline SHA in findings add command + tests"
    status: done
  - title: "Show short reviewed-at SHA in findings list + test"
    status: done
  - title: "Document reviewedAt in findings command docs"
    status: done
---

# Phase 156 — report from the auto session

## What was done

Added an optional `reviewedAt` SHA to each adversarial finding, additively.

- **Store (`findingsStore.ts`)** — `Finding` and `NewFinding` gained an optional
  `reviewedAt`. `serializeFindings` emits a `**Reviewed-at:** <sha>` line right
  after `**Where:**`, only when present. A new `REVIEWED_AT_RE` and a rewritten
  `parseEntryBody` read it; absence → `undefined`. `addFinding` copies the trimmed
  value. The store stays git-free (no new imports).
- **Command (`findings.ts`)** — `findingsAdd` now resolves the SHA itself:
  `isGitRepo(cwd)` first, then `headSha(cwd)`; the field is set only when both
  succeed. Outside git or a fresh repo with no HEAD → omitted, no error. The
  working-tree state is deliberately **not** gated on (the review runs on a dirty
  tree by design).
- **List** — `renderFinding` appends `@<short>` (7 chars) when a finding carries a
  SHA, so the line stays readable.
- **Docs** — `docs/non-interactive/findings.md` documents the field honestly as a
  baseline, not the reviewed commit, plus the entry-format and `list` examples.

## Honest caveat (by design, agreed in discussion)

`reviewedAt` is the phase's **parent** commit, not the reviewed code's commit.
The review runs between `do` and `done` while the phase work is uncommitted, so
HEAD is the baseline. Storing the reviewed commit's own SHA is impossible to do
cleanly (self-reference; amend changes the SHA; an extra commit breaks
`mini undo`'s `HEAD^ === preSha` invariant), so it was explicitly left out. A
later consumer (todo [6]) must derive the reviewed commit as the child of the
baseline — this phase only records the anchor; it does not consume it. Without
that consumer the field has no reader yet, which is expected.

## Verification (all mechanical, done here)

- `npm run typecheck` — clean.
- `npx vitest run` — 79 files, **1057 tests pass**.
- Unhappy paths covered by tests: old file with no `**Reviewed-at:**` parses
  identically; minimal finding without the field serializes with no empty line;
  non-git temp dir omits the field (existing behaviour preserved); git repo with
  a commit stamps `reviewedAt === HEAD`; `list` shows the short SHA and never the
  full 40-char hash.
- The adversarial prompt snapshot is unchanged (no `--reviewed-at` flag added —
  mini stamps the SHA, the model never passes it), confirmed by the passing
  `sessionContext` snapshot.

No human-only verification needed — there is no UI/UX surface, only CLI output
covered by tests. No ADR-worthy crossroads beyond what the discussion already
recorded.
