# Phase 156 — Stamp reviewed-at SHA on findings

**Goal:** Record the HEAD SHA at review time as an optional reviewedAt metadata field on each finding (stamped in addFinding via headSha, surfaced in mini findings list), additive so existing findings files still parse.

## Steps
- [done] reviewedAt in findings store + tests
- [done] Stamp baseline SHA in findings add command + tests
- [done] Show short reviewed-at SHA in findings list + test
- [done] Document reviewedAt in findings command docs

## Auto-commit
- Phase 156: Stamp reviewed-at SHA on findings

## Discussion
# Phase 156 — Stamp reviewed-at SHA on findings

## Intent
Add an optional `reviewedAt` SHA to each finding so a later consumer (todo [6])
can judge whether a finding is still relevant after the code moved on. The
review (adversarial / `mini findings add`) runs **between `do` and `done`**: the
phase status is `doing`, the working tree is **dirty**, and `HEAD` points at the
**previous** phase's commit. The reviewed code itself is uncommitted at that
moment.

Therefore `reviewedAt` = `headSha` at review time = the phase's **baseline**
(parent) commit — the same value `done` later records as `autoCommit.preSha`. It
is **not** the commit of the reviewed code (that commit only exists after
`done`). The field must be described honestly as "the baseline the reviewed work
was built on", not "the reviewed commit".

This is the only SHA that can be cleanly stored. See "Watch out for".

## Key decisions
- **Path A (baseline SHA), honest semantics.** Store `reviewedAt` = baseline.
- **Stamp in the command, not in the store.** `findingsStore.ts` stays git-free.
  `findingsAdd` resolves the SHA via `headSha` and passes it into `addFinding`.
  Extend `Finding` and `NewFinding` with optional `reviewedAt`.
- **Order of git checks in `findingsAdd`:** `isGitRepo` first. Only inside a repo
  call `headSha`. `isCleanWorkingTree` is NOT used as a gate (review runs on a
  dirty tree by design — gating on clean would block the real flow).
- **Outside git / fresh repo with no HEAD** → `headSha` returns `null` → omit the
  field, no error, no empty `**Reviewed-at:**` line (per the additive rule).
- **File format:** new optional metadata line under the entry header, next to
  `**Where:**`, e.g. `**Reviewed-at:** <sha>`. The header line
  `## <id> · <severity> · <status>` stays untouched. Parser must accept entries
  without this line so existing `.mini/findings/phase-*.md` round-trip unchanged.
- **Storage = full 40-char SHA. Display = short (7–12 chars)** in
  `mini findings list`.
- **NO `done` back-fill of the reviewed commit SHA.** Explicitly out of scope and
  technically impossible to do cleanly (see "Watch out for").
- **The sequencing gate ("only after `do` finished") is dropped.** No reliable
  signal exists: the run report is written only in auto mode (`do.ts:125`), and
  status `doing` is set at the *start* of `do`, so it cannot distinguish running
  from finished.

## Watch out for
- **Do not try to write the phase's own commit SHA into the findings file in
  `done`.** Every option fails: (1) same commit → self-reference, impossible;
  (2) `git commit --amend` → amend changes the SHA, so the written value is
  wrong; (3) a second stamp-only commit → breaks `mini undo`, which requires
  `HEAD^ === autoCommit.preSha` and a clean tree (`undo.ts:11`, `undo.ts:138`);
  (4) leaving the file dirty after `done` → violates "nothing left hanging" and
  the undo clean-tree check, and bleeds into the next phase's commit.
- **`reviewedAt` is the baseline, not the reviewed code.** A naive consumer doing
  `git log <reviewedAt>..HEAD -- <file>` will see the phase's own commit and flag
  every finding as stale. The reviewed commit is the *child* of `reviewedAt`;
  deriving it is the consumer's job (todo [6]), not this phase's.
- **Additive parsing is the core acceptance test.** An existing findings file
  with no `**Reviewed-at:**` line must parse and serialize identically. Add a
  round-trip test for both with-SHA and without-SHA entries.
- **Existing `findings add` behaviour must be preserved off-git.** Current
  `findings.test.ts` likely runs in a non-git temp dir → `isGitRepo` false →
  field omitted → same output as today. Verify the new git calls don't break
  those tests (mock git or assert the no-repo path).
- **`headSha` at add-time must equal `autoCommit.preSha`** that `done` records —
  HEAD does not move between `do` and `done`. If a test asserts the value, anchor
  it to a known commit, not to `headParentSha`.
- **Update the adversarial prompt snapshot only if the prompt text changes.** The
  `mini findings add` invocation does not gain new required flags (SHA is stamped
  by mini, never passed by the model), so the prompt likely stays the same — do
  not invent a `--reviewed-at` flag for the model to pass.

## Run report
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
