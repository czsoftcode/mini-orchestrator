---
phase: 143
verdict: done
steps:
  - title: "Trim 'Import from GSD' in README"
    status: done
  - title: "Move Workflow tips to docs/faq.md"
    status: done
  - title: "Verify links and length"
    status: done
---

# Phase 143 — report from the auto session

Two small end-of-README sections cleaned up.

- **Import from GSD** trimmed from a five-line paragraph to two sentences: one line of positioning (lighter-weight GSD alternative, minimal state) + how to import (`mini import-gsd`, leaves `.planning/` untouched), keeping the `docs/non-interactive/import-gsd.md` link.
- **Workflow tips** (the four bullets) moved verbatim into a new `## Workflow tips` section at the end of `docs/faq.md`; the standalone README section is gone. faq.md is the most discoverable user-facing concept page, so the tips stay findable.

**Verified mechanically:** README 328 → 321 lines (−7). The import-gsd link resolves; the tips are present in docs/faq.md and absent from README; no double blank lines at the License seam. Only `.md` files changed — no typecheck/tests relevant.

No real rejected alternative, so no ADR. Nothing for a human to verify subjectively this time (the GSD trim kept the positioning sentence; tips are a verbatim move).

**Campaign status:** README 396 → 321. The B block (move reference content to docs/) is now done. Remaining: **C** — section reorder ("How is this different" above Installation) and dropping the duplicate text transcript in "See it in action"; **A** — cleanups (remove CI/billing comment, reduce the 3× illustrative disclaimers, verify the GIF); **D** — final length check toward the ~150 target.
