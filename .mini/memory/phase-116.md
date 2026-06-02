# Phase 116 — GitHub Sponsors FUNDING.yml

**Goal:** Add .github/FUNDING.yml pointing the repo Sponsor button at the GitHub Sponsors account czsoftcode, and document the sponsor button in the README so contributors can support the project.

## Steps
- [done] Add .github/FUNDING.yml
- [done] Document sponsoring in README
- [done] Wrap up and checks

## Auto-commit
- Phase 116: GitHub Sponsors FUNDING.yml

## Run report
---
phase: 116
verdict: done
steps:
  - title: "Add .github/FUNDING.yml"
    status: done
  - title: "Document sponsoring in README"
    status: done
  - title: "Wrap up and checks"
    status: done
---

# Phase 116 — report from the auto session

## What was built
- **`.github/FUNDING.yml`** — `github: [czsoftcode]`, so the repo's **Sponsor**
  button (enabled in repo settings) points at GitHub Sponsors for the owner
  account. Includes a comment link to GitHub's funding-button docs.
- **README "Support" section** — a short section just above License linking to
  `https://github.com/sponsors/czsoftcode` and the repo Sponsor button.

## Verified mechanically
- `FUNDING.yml` parses as YAML → `{ github: ["czsoftcode"] }`.
- `npm run typecheck` — clean.
- `npm test` — 68 files, **854 tests pass** (config/docs only, no regression).

## Note for the human
The GitHub Sponsors option under the button only renders once the **czsoftcode
Sponsors profile is published** (profile + tiers + Stripe Connect bank + tax form
completed and approved at github.com/sponsors). The user has a Stripe account and
is going the GitHub Sponsors route; until the profile is live the button may show
nothing or only other configured platforms. The FUNDING.yml itself is correct and
ready — no code change is needed when the profile goes live.
