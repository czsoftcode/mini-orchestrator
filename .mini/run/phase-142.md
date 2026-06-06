---
phase: 142
verdict: done
steps:
  - title: "Create docs/context.md"
    status: done
  - title: "Trim 'What gets sent' in README to ~2 lines"
    status: done
  - title: "Trim the graph section + index the context page"
    status: done
  - title: "Verify links and length"
    status: done
verify:
  - title: "Read the trimmed 'What gets sent to Claude' section — is the token-efficiency selling point still strong enough inline?"
    detail: "Kept inline: ~600-1000 token budget (softened to 'roughly'), Claude reads files itself, the machine-map navigation point. Moved to docs/context.md: the per-call cost-line example and the longer phrasing. Subjective call on how much of this sales-relevant content belongs in README vs docs."
---

# Phase 142 — report from the auto session

Moved the context/cost detail into docs and folded the graph blurb into the same README section.

- **docs/context.md** (new) — the full "What gets sent to Claude" content: the ~600-1000 token budget, "Claude reads files itself via Read/Glob/Grep", a pointer to the machine-readable map, and the per-call cost-line example. Linked from the "Concepts & guides" index in docs/README.md.
- **README "What gets sent to Claude"** — trimmed to two short paragraphs: one on the token budget (exact count softened to **"roughly 600–1000 tokens"**, the agreed A4 change) + Claude reading files itself + link to docs/context.md; one on the machine map + link to `mini map`. The cost-line code block is gone from README.
- **The standalone `## Machine-readable project map (graph)` heading was removed** — its one-sentence essence now lives as the second paragraph under "What gets sent to Claude", with the `docs/non-interactive/map.md` link preserved. (The map detail — incremental remaps, the PostToolUse hook — was already only in docs, so nothing was lost.)

**Verified mechanically:** README 340 → 328 lines (−12). Links resolve (docs/context.md, docs/non-interactive/map.md, context.md→map.md internal link, index entry). No stale `## Machine-readable` heading, no leftover `14.1k from cache` cost block in README, no double blank lines. Only `.md` files changed — no typecheck/tests relevant.

No real rejected alternative, so no ADR.

**Open question for the human:** is the inline token-efficiency pitch still strong enough after the trim (see `verify`)? It's the one sales-vs-docs judgement call in this phase.

**Campaign status:** README 396 → 328. Remaining: B6 (GSD trim), B7 (Workflow tips), then C (reorder + duplicate transcript) and A (cleanups incl. the agreed CI-comment removal), D (final length check).
