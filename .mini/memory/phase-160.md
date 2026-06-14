# Phase 160 — Verify findings to durable store

**Goal:** Route mini:verify findings to the .mini/findings/ store via mini findings add and make verifyContext treat the run report as optional, three-state-tolerant context (valid/corrupt/missing), so verify findings are no longer silently dropped when the report is unparseable or absent.

## Steps
- [done] source field in findings store model
- [done] --source flag on mini findings add
- [done] Route verify prompt + context to the store
- [done] Surface verify findings source in next
- [done] Build green + full test suite green

## Auto-commit
- Phase 160: Verify findings to durable store

## Discussion
# Phase 160 — Verify findings to durable store

## Intent
Today `mini:verify` tells the human-led reviewer to append findings into the run
report (`## Verify findings`) and, for a closed phase, also into the memory file.
That makes verify findings fragile: a corrupt/missing report (and, after `done`,
a closed phase's buried report) silently drops them, and `next` never surfaces
them. Adversarial review already solved this by routing findings to the durable
`.mini/findings/` store via `mini findings add`, independent of report parse
state. This phase mirrors that for verify.

Scope is **where the verify findings go**, not the verify-items skeleton
(`readReportVerify`) the reviewer walks through — that keeps being read from the
report (already tolerant: corrupt report → empty skeleton).

## Key decisions
- **Chosen: share the existing findings store AND add a `source` field**
  (`verify | adversarial`) to `Finding`, so origin stays distinguishable.
  (Rejected: relabel-only sharing without a field; and report-only fix that
  doesn't actually mirror adversarial.)
- **Default `source` = `adversarial`** when the metadata line / `--source` flag
  is absent. This keeps existing `.mini/findings/*.md` files and the unchanged
  adversarial prompt correct; only the verify prompt passes `--source verify`
  explicitly.
- **Verify prompt switches to `mini findings add --source verify …`** (one call
  per finding), dropping the `## Verify findings` report-write and the
  closed-phase memory-write branches. Carry over the adversarial PATH caveat
  ("if `mini` is not on PATH, say so in chat instead of writing to a file").
- **Store header relabel** from `# Adversarial findings` to a source-agnostic
  title (e.g. `# Review findings`) + comment mentioning both verify and
  adversarial. Entry header line `## <id> · <severity> · <status>` stays
  unchanged (don't touch `ENTRY_RE`); `source` is a new metadata line under the
  entry alongside `**Where:**` / `**Reviewed-at:**` (e.g. `**Source:** verify`).
- **`next` already surfaces open findings** (`listFindings`) — verify findings
  now appear there too. Optional polish (plan may include or defer): tag each
  surfaced line with its source so verify vs adversarial is visible; rename the
  "Open adversarial findings" comment/label to be source-agnostic.

## Watch out for
- **Backward compatibility:** existing findings files have no `**Source:**` line
  and the old `# Adversarial findings` header → must parse as `source:
  'adversarial'`; the first `add` rewrites the header to the new neutral text
  (acceptable). Must not break existing entries or the parse → serialize
  round-trip.
- **No migration** of `## Verify findings` sections already sitting in old run
  reports — they stay as plain report text; do not attempt to import them.
- **Lifecycle inheritance:** verify findings now behave like adversarial ones —
  candidates in `next`, linkable via `--from-finding`, auto-resolved on `done`
  (Phases 157–159). This is intended (the durability goal), but confirm nothing
  in that path assumes adversarial-only.
- **Forgotten `--source` flag** silently mislabels a verify finding as
  adversarial (the default). Low impact, accepted.
- **Severity vocabulary** (`blocker/should-know/nit`) is code-review-flavored but
  fits UX findings; do not invent a new vocabulary.
- **Validate `--source`** like `--severity` (an `isFindingSource` guard +
  `FINDING_SOURCES`); reject unknown values.
- **Tests to update/extend:** `findingsStore.test` (source parse/serialize,
  default-adversarial on missing line, round-trip), `findings.test` (`--source`
  flag + validation + default), the verify snapshot in `sessionContext.test`,
  and any adversarial snapshot that round-trips the relabeled header.
- **Out of scope unless trivial:** an adversarial-style status line
  (`pass/findings/blocked`) for verify — verify keeps its existing
  done/do recommendation closing.

## Run report
---
phase: 160
verdict: done
steps:
  - title: "source field in findings store model"
    status: done
  - title: "--source flag on mini findings add"
    status: done
  - title: "Route verify prompt + context to the store"
    status: done
  - title: "Surface verify findings source in next"
    status: done
  - title: "Build green + full test suite green"
    status: done
verify:
  - title: "Run /mini:verify end-to-end and confirm findings land in .mini/findings/"
    detail: "I verified the prompt text, CLI flag, store round-trip and full suite mechanically, but the interactive verify session (Claude actually calling `mini findings add --source verify` per finding during a real human review) is human-led and was not exercised live. Worth one real run on a UI/UX phase."
---

# Phase 160 — report from the auto session

## What was done

Verify findings now go to the durable `.mini/findings/` store (the same store
adversarial uses), tagged with a `source`, instead of being appended into the
run report. This mirrors the adversarial redesign, so verify findings survive a
corrupt/missing report and a closed phase, and surface in `mini next`.

- **Store model** (`findingsStore.ts`): added `FindingSource` (`adversarial` |
  `verify`), `FINDING_SOURCES`, `DEFAULT_FINDING_SOURCE`, `isFindingSource`, and
  `Finding.source` / `NewFinding.source`. Parser reads an optional `**Source:**`
  line (missing → `adversarial`; an unknown value is consumed and falls back to
  the default, so it can't be mistaken for the title); serializer always emits it.
  Header relabeled `# Adversarial findings` → `# Review findings`. `ENTRY_RE`
  untouched.
- **`mini findings add`** (`findings.ts` + `cli.ts`): `--source <adversarial|
  verify>`, validated, default `adversarial`. `list` output now shows the source
  (`id [severity] <source> …`). Commander also enforces `--choices` at the CLI
  layer.
- **Verify prompt/context** (`sessionContext.ts`, `verifyContext.ts`): the
  recording instruction is now one `mini findings add --source verify` call per
  finding, with the PATH caveat; the `## Verify findings` report-write and the
  closed-phase memory-write branches are gone. The verify-items skeleton + free
  text are still read from the report as optional context (existence-guarded read,
  since `readReportVerify` only tolerates parse errors, not ENOENT). Czech JSDoc/
  test names translated to English along the way.
- **`next` surfacing** (`context.ts`, `sessionContext.ts`): `OpenFinding.source`
  threaded through; each surfaced line is tagged `… · <source> · …`; the heading
  is now `# Open review findings` (was adversarial-only). `--from-finding`
  wording made source-agnostic.
- **Docs**: `docs/interactive/verify.md`, `docs/non-interactive/verify.md` and
  `docs/non-interactive/findings.md` updated (store, `--source`, `**Source:**`
  line, both review steps).

## Verification (mechanical)

- `npm run build` clean; full suite **1099 passed** (80 files).
- New/updated tests: store source round-trip, default-adversarial on a missing
  line, unknown-source fallback, `--source verify` persistence, command default +
  invalid-source rejection, verify prompt routes to the store (no report/memory
  write), `next` tags findings by source.
- Unhappy paths checked live: `findings add --source garbage` → rejected with a
  clear message; `context verify` renders the store instruction and no report
  write.
- Token snapshots (`measure.test.ts`) regenerated for the changed `next`/`verify`
  prompts.

## Notes / follow-ups (not in scope here)

- **Decision worth recording:** the store-sharing-plus-`source`-field choice over
  a relabel-only or report-only fix was a real fork settled in discuss — consider
  `/mini:decision` before `/mini:done`.
- **Linked-finding block still says "adversarial":** `renderLinkedFindingBlock`
  (the `# Linked adversarial finding` block in `plan`/`discuss`, Phase 158) was
  left as-is. A verify-sourced finding linked via `--from-finding` now renders
  under an "adversarial" heading — a small wording inaccuracy this phase
  introduces. Left out to respect the agreed scope; easy follow-up to make the
  label source-aware.
- **Pre-existing stale doc line:** `findings.md` still says "flipping a finding to
  resolved … is a planned follow-up" though Phase 159 added resolve-on-done. Not
  touched (predates this phase).
