---
phase: 188
verdict: done
steps:
  - title: "Static per-label regex in matchField"
    status: done
  - title: "Manual heredoc-close scan in phpMapper"
    status: done
  - title: "Manual TOML-header scan in projectVersion"
    status: done
  - title: "Parser tests stay green"
    status: done
  - title: "No dynamic RegExp remains at sites"
    status: done
---

# Phase 188 — report from the auto session

## What was done

Removed the four `detect-non-literal-regexp` (ReDoS) findings by eliminating the
`new RegExp(<variable>)` calls at the three flagged sites. All four findings were
genuine false positives (Semgrep auto-triaged them as such), so this is a
linter-noise cleanup, not a security fix — the user explicitly chose to rewrite
rather than suppress with `nosemgrep`.

- **`next.ts`** — `matchField` now selects from a static `FIELD_RE` record with
  two precomputed literal regexes (`TITLE`, `GOAL`). Behaviour is byte-identical
  to the old dynamic pattern.
- **`phpMapper.ts`** — heredoc/nowdoc close detection moved from
  `new RegExp(\`\\n[ \\t]*${tag}\\b\`)` to a manual `findHeredocClose` scan
  (newline → optional spaces/tabs → exact tag → word boundary). Added an
  `isPhpWordChar` helper for the `\b` semantics. Also translated the file-level
  Czech JSDoc to English (project rule).
- **`projectVersion.ts`** — TOML `[section]` lookup moved from a dynamic
  `headerRe` to a manual `findTomlSectionBody` scan (header at file start or
  after a newline, line must end with a newline). The now-unused `escapeRegExp`
  helper was deleted.

## Verification (done mechanically)

- `tsc` typecheck: clean.
- Full suite: **1263 tests pass** (87 files). Added 5 edge-case tests:
  - phpMapper: unclosed heredoc swallows to EOF; close tag only counts at line
    start with a word boundary (`NOTEOT`/`EOTISH` do not close).
  - projectVersion: last section with no trailing newline; a `[package]`-looking
    token inside a value is ignored; dotted section name `[tool.poetry]` matches
    literally.
- `rg` confirms the three sites no longer call `new RegExp(`; none of the four
  original findings remain.

## Note / out of scope

`src/commands/project.ts:32` still has a dynamic `new RegExp` built from the
hardcoded `LABELS` array. Semgrep did **not** flag it (it is a module-level
constant, not a function-argument taint), so it is outside the scope of these
four findings and was left untouched. If we want zero dynamic-regex calls in the
repo as a policy, that line would be a follow-up.

## Trade-off honesty

The two manual scans (`findHeredocClose`, `findTomlSectionBody`) are more code
and a new surface for edge-case bugs than the one-line regexes they replace —
paid purely to satisfy a linter on non-vulnerabilities. The added failure-path
tests are there precisely because that risk is real.
