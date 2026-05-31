# Phase 84 — English CLAUDE.md instructions

**Goal:** Translate the project's CLAUDE.md fully into English so it suits any developer of the public mini-orchestrator, dropping the personal 'communicate in Czech' rule (the maintainer moves that preference to their global ~/.claude/CLAUDE.md), while keeping the i18n policy that everything inside the program stays English.

## Steps
- [done] Translate CLAUDE.md body to English
- [done] Drop the personal Czech-communication rule
- [done] Verify English-only & consistency

## Auto-commit
- Phase 84: English CLAUDE.md instructions

## Run report
---
phase: 84
verdict: done
steps:
  - title: "Translate CLAUDE.md body to English"
    status: done
  - title: "Drop the personal Czech-communication rule"
    status: done
  - title: "Verify English-only & consistency"
    status: done
---

# Phase 84 — report from the auto session

`CLAUDE.md` is now fully English and developer-oriented. The "Project language"
section keeps the i18n policy (everything inside the program is English: UI, CLI
help, logs, error messages, comments/JSDoc, README & CHANGELOG incl.
`/mini:done` entries) and the "left untouched" list (identifiers, technical
terms, quoted foreign output, parser response contract & status words).

The personal "communicate in Czech" section was removed entirely — the
maintainer moves that preference to their global `~/.claude/CLAUDE.md`. The
now-obsolete note "Czech stays only in this CLAUDE.md" was dropped rather than
rephrased, since the file no longer holds any Czech-only rule.

## Verification
- No Czech diacritics remain in `CLAUDE.md` (grep clean).
- `README.md` does not reference `CLAUDE.md` or any language rule → no contradiction.

## Follow-up (out of scope, deferred)
- `docs/i18n-glossary.md` is still entirely in Czech and is scheduled for a
  separate phase. Its note (lines 10–11, 168, 179) still claims "Czech stays
  only in CLAUDE.md", which is now stale. Fix it when that doc is translated.
