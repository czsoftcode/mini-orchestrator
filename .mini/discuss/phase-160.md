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
