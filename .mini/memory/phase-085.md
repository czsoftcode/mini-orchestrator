# Phase 85 — English install-local + dev note

**Goal:** Translate the comments and output of scripts/install-local.sh into English, and add a short developer note to README.md about the local dev installation (npm run install-local).

## Steps
- [done] Translate install-local.sh comments to English
- [done] Translate install-local.sh echo output to English
- [done] Add local dev install note to README
- [done] Verify English-only & run install-local

## Auto-commit
- Phase 85: English install-local + dev note

## Run report
---
phase: 85
verdict: done
steps:
  - title: "Translate install-local.sh comments to English"
    status: done
  - title: "Translate install-local.sh echo output to English"
    status: done
  - title: "Add local dev install note to README"
    status: done
  - title: "Verify English-only & run install-local"
    status: done
---

# Phase 85 — report from the auto session

All steps done.

## What was done
- **`scripts/install-local.sh`** — rewrote the header comment block and all
  runtime `echo` messages into English (`→ installing into …`,
  `→ production npm install (runtime deps only)`, `mini X installed.`,
  `Try: mini --version`). No Czech characters remain (verified with a grep).
- **`README.md`** — added a developer note under
  `### From git / for development` documenting `npm run install-local`: that it
  builds and installs under `~/.local`, the layout (symlink + versioned
  directory), the rollback behaviour (older versions kept), and how to verify
  (`mini --version`).

## Bonus (outside the original scope)
While verifying, I noticed the build still printed one stray Czech line from a
different script — `scripts/copy-assets.mjs` (`→ assety zkopírovány: …`). Per the
project's i18n policy (translate Czech wherever encountered), I changed it to
`→ assets copied: …`. One-liner, no behaviour change.

## Verification
- `grep` for Czech characters in `install-local.sh` → none.
- `npm run install-local` runs cleanly; full output is English.
- `mini --version` → `1.5.2`.

Nothing requires a human eye — everything was verifiable mechanically.
