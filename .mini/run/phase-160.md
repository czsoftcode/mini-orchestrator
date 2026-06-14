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
