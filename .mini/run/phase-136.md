---
phase: 136
verdict: done
steps:
  - title: "Audit map.md coverage gaps"
    status: done
  - title: "Enrich map.md docs"
    status: done
  - title: "Slim graph sections to a blurb"
    status: done
  - title: "Fix cross-refs and verify"
    status: done
verify:
  - title: "Graph blurb reads well after the slim-down"
    detail: "Mechanically verified: README 458 → 423 lines, all docs links resolve, the (see below) ref fixed to (see above), no dangling refs. The subjective flow of the new one-paragraph graph blurb + pointer is worth a human read."
---

# Phase 136 — report from the auto session

## What was done

Collapsed the three graph sections into one paragraph plus a pointer, moving the
mechanics to docs first so nothing was lost.

- **`docs/non-interactive/map.md`** — enriched **before** cutting from the README,
  because the docs only had the flags in a table, not the detail. Added two
  sections: "Incremental update (`--file`)" (per-file = identical to a full
  rebuild, `graph.json` fallback, no-op for ignored/non-mappable, node removal on
  delete) and "Auto-update after an edit (hook)" (the full PostToolUse
  `settings.json` snippet with matcher `Edit|Write|MultiEdit`, plus the rationale:
  no `jq` dependency, `>/dev/null 2>&1 || true` quiet/non-blocking, and the
  deletion/rename reconciliation caveat).
- **README** — replaced `## Machine-readable project map` + `### Incremental
  update (--file)` + `### Auto-update after an edit (hook)` (~40 lines incl. the
  hook JSON block) with one short paragraph (what the graph is, the `@L` anchors,
  navigate-without-reading, gitignored/regenerable) plus a one-line pointer to
  [`mini map`](docs/non-interactive/map.md).
- Fixed the `(see below)` reference in the `## Files in the project` tree to
  `(see above)`, since the graph paragraph now sits above that tree.

## Verification

- README: **458 → 423 lines** (−35).
- All five `docs/*.md` links in the README resolve to existing files (incl. the
  new `map.md` pointer).
- No leftover `#incremental`/`#auto-update` anchors; the only remaining
  `--file`/`PostToolUse` mention is the intentional pointer line.

## Trade-off

Net README reduction is −35 lines, smaller than a pure delete, because the docs
grew by ~45 lines. Deliberate: the hook snippet and `--file` nuances are real,
useful detail — they move to docs, they don't vanish.

## Notes

No architectural crossroads here, so no ADR needed. Next: `/mini:done`.
