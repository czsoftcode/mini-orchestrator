---
phase: 177
verdict: done
steps:
  - title: "Add stripFindingsSections helper"
    status: done
  - title: "Unit tests for stripFindingsSections edge cases"
    status: done
  - title: "Apply helper at the three embed sites"
    status: done
  - title: "Prompt-level tests: stale sections don't reach the prompt"
    status: done
  - title: "Verify build, typecheck and tests pass"
    status: done
---

# Phase 177 — report from the auto session

## What was done
- Added `stripFindingsSections(body: string): string` to `src/state/runReport.ts`.
  It normalizes BOM/CRLF, then walks the body line by line. When it hits a level-2
  heading whose title is exactly `adversarial findings` or `verify findings`
  (case-insensitive), it drops that heading and everything after it up to the next
  heading of level `##` or higher (`#`), or the end of text. Everything else —
  prose and unrelated `##` sections — is kept; the result is trimmed.
- Wired the helper into all three `# Implementation report` embed sites in
  `src/prompts/sessionContext.ts` (done / verify / adversarial). For done and
  verify an empty result behaves as "no report" (empty block); for adversarial it
  keeps the existing git-diff fallback line.

## Design choices (worth knowing)
- **Exact-title match, not prefix/contains.** A heading like
  `## Adversarial findings and lessons` is left untouched on purpose — only the
  exact stale titles get stripped, so legitimate prose with a similar heading
  isn't silently eaten. Trade-off: if some old report used a slightly different
  heading (e.g. `## Adversarial review`), it won't be stripped. That's
  intentional — better to leave unknown text in than to guess and delete real
  notes.
- **Boundary is "next heading of level ## or higher".** A `#` (top-level) heading
  also ends the stale section, so a `# Implementation report` heading after the
  findings is preserved.
- This is purely defensive cleanup: today findings go to `.mini/findings/`, so a
  freshly written report has no such section and the helper is a no-op on it.

## Unhappy-path coverage (tests)
`src/state/runReport.test.ts` covers: section mid-body, at end of file, two
consecutive sections, no section (unchanged), section followed by a `#` heading,
empty/whitespace body, CRLF + BOM, exact-title guard (non-match kept), and
case-insensitive match. Prompt-level tests in `src/prompts/sessionContext.test.ts`
assert all three builders drop the stale sections but keep surrounding text, plus
the adversarial "only-stale-section → git-diff fallback" case.

## Verification
- `npm run build` — OK
- `npm run typecheck` — no errors
- full suite — 1202 tests passing (87 files)

Nothing here needs a human eye — it's text manipulation verified mechanically.
