---
phase: 173
verdict: done
steps:
  - title: "New docs/security.md trust-boundary guide"
    status: done
  - title: "Short Security note in README"
    status: done
  - title: "Cross-link from docs index, FAQ and auto"
    status: done
  - title: "Accuracy + link verification"
    status: done
verify:
  - title: "Read the README Security paragraph and docs/security.md for tone/clarity"
    detail: "Pure documentation — no tests/build to run. Worth a human read to confirm the warning lands without sounding like mini has a technical defense it doesn't (the only safety is the human 'done' checkpoint)."
---

# Phase 173 — report from the auto session

## What was done

- **`docs/security.md`** — new standalone guide. Covers: what mini feeds the agent
  (git-shared `.mini/`: project.md, phase goals, discuss/run reports), the SEC-1
  prompt-injection risk under `mini auto` (`acceptEdits`), three mitigations (human
  `done` checkpoint as the main net; read an untrusted `.mini/` before running;
  don't run `mini auto` unattended on un-reviewed repos), and a note that mini
  stores no secrets. Cites `.mini/security/range-1-25.md` (SEC-1).
- **README** — new `## Security` section (3 sentences + link), placed right after
  "What gets sent to Claude". Kept deliberately short per the README slim-down
  phases (131–146); full content stays in docs.
- **Cross-links** — `docs/security.md` added to "Concepts & guides" in
  `docs/README.md`; a warning bullet added to the **Notes** section of
  `docs/non-interactive/auto.md` (the page where `acceptEdits` is already
  explained), linking back to the guide.

## Accuracy checks (done mechanically)

- Verified the core claim against code: `src/commands/do.ts:138`
  `const permissionMode = opts.auto ? 'acceptEdits' : undefined;` — acceptEdits
  only in auto mode, classic permission in plain `mini do`. Matches the FAQ.
- Confirmed `opts.auto` is an **internal** option (set by `auto.ts`), not a public
  `mini do --auto` CLI flag — reworded `docs/security.md` so it doesn't imply a
  flag that doesn't exist.
- All new relative links resolve (`../.mini/security/range-1-25.md`,
  `docs/security.md`, `../security.md`, `security.md`).
- No inline `<script>`/`style=` introduced (grep clean) — relevant to the CSP rule,
  though these are plain markdown docs.

## Decisions / deviations

- The plan's step 3 said FAQ **and/or** auto. I put the pointer in **auto.md only**,
  not the FAQ. Reason: the FAQ's acceptEdits entry is a permissions answer, not a
  security one; auto.md is where `acceptEdits` is actually described and where the
  risk applies, so a second pointer in the FAQ would be redundant. Not a
  weigh-and-reject crossroads worth an ADR.

## Caveat

This is documentation, not a technical control. The text is explicit that the
boundary is **inherent** to what mini is and the human `done` checkpoint is the
only real safety net — nothing here changes mini's behaviour or adds enforcement.
