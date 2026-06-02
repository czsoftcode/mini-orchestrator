# Phase 115 — GitHub issue templates + CONTRIBUTING

**Goal:** Add GitHub community files: issue forms (bug report + feature request) under .github/ISSUE_TEMPLATE with a config.yml, a pull-request template, and a root CONTRIBUTING.md that links the existing dev-setup and mini workflow docs — guiding contributors through reporting and submitting changes.

## Steps
- [done] Issue forms for bug and feature
- [done] Issue template chooser config
- [done] Pull request template
- [done] CONTRIBUTING.md at repo root
- [done] Wrap up and checks

## Auto-commit
- Phase 115: GitHub issue templates + CONTRIBUTING

## Run report
---
phase: 115
verdict: done
steps:
  - title: "Issue forms for bug and feature"
    status: done
  - title: "Issue template chooser config"
    status: done
  - title: "Pull request template"
    status: done
  - title: "CONTRIBUTING.md at repo root"
    status: done
  - title: "Wrap up and checks"
    status: done
---

# Phase 115 — report from the auto session

## What was built
GitHub community / onboarding files:

- **`.github/ISSUE_TEMPLATE/bug_report.yml`** — a GitHub *issue form* (not a plain
  template) with required preflight checkboxes, a description, repro steps
  (shell-rendered), optional logs, and required mini/Node/OS fields. Labeled `bug`.
- **`.github/ISSUE_TEMPLATE/feature_request.yml`** — issue form with motivation +
  proposal required, alternatives/context optional, a duplicate-search checkbox.
  Labeled `enhancement`.
- **`.github/ISSUE_TEMPLATE/config.yml`** — `blank_issues_enabled: false` plus
  contact links to Discussions, the README, and the website, so usage questions
  are steered away from the issue tracker.
- **`.github/PULL_REQUEST_TEMPLATE.md`** — a contributor checklist (typecheck,
  tests, docs, CHANGELOG, English, focused scope) and a "related issue" line.
- **`CONTRIBUTING.md`** (repo root) — ways to contribute, dev setup with a script
  table (build / dev / typecheck / test / install-local), the PR workflow, the
  English-language policy (mirrors the project's CLAUDE.md), a "mini dogfoods
  mini" note, and a security-reporting note. Links into the README and LICENSE.
- Ticked off backlog item #14 (`mini todo done 14`).

## Verified mechanically
- All three issue YAML files parse cleanly (validated with the `yaml` library).
- `npm run typecheck` — clean.
- `npm test` — 68 files, **854 tests pass** (no regression; these are config/docs files).
- Markdown links in CONTRIBUTING point at existing files/anchors (LICENSE,
  README#from-git--for-development, README#quick-start, the issue templates).

## For the human
These files only fully render on GitHub. After this phase is pushed you may want
to glance at **Issues → New issue** (the bug/feature forms + the config chooser
with its contact links) and open a draft PR to see the PR template — all standard
GitHub behavior, nothing blocking. The Discussions contact link assumes the
Discussions feature is enabled on the repo; enable it in repo settings if it is
not, otherwise that link 404s.
