---
phase: 155
verdict: done
steps:
  - title: "Findings store module + tests"
    status: done
  - title: "mini findings add command"
    status: done
  - title: "mini findings list command"
    status: done
  - title: "Rewire adversarial prompt to store"
    status: done
  - title: "Tighten adversarial tool scope"
    status: done
  - title: "Findings versioned + command docs"
    status: done
verify:
  - title: "A real `mini adversarial` session records findings via `mini findings add`"
    detail: "I verified the prompt text, the `mini findings add`/`list` CLI live in a temp project, and the allowedTools set (Edit removed, scoped `Bash(mini findings add:*)` added). I could NOT verify from here that, in an actual Claude Code red-team session, (a) `mini` is on PATH so the model's `mini findings add` call succeeds, and (b) Claude Code actually enforces the scoped `Bash(... :*)` grant. Run `mini adversarial` on a phase once and confirm a finding lands in `.mini/findings/` and that the reviewer cannot edit source files."
---

# Phase 155 — report from the auto session

## What was built
A durable adversarial-findings store, decoupled from the run report.

- **`src/state/findingsStore.ts`** — `.mini/findings/phase-{id}.md`, one file per
  origin phase, multiple entries each `## <id> · <severity> · <status>` + optional
  `**Where:**` + title + optional body. `addFinding` (sequential id per phase,
  read-modify-write), `listFindings` (open across all phases by default,
  `includeResolved` for resolved), `parseFindings`/`serializeFindings`,
  `readPhaseFindings`. 19 unit tests.
- **`src/commands/findings.ts` + cli wiring** — `mini findings add --severity
  --title [--where] [--body]` (origin phase inferred: current, else last `done`;
  prints the assigned id + path so a failed call is visible) and `mini findings
  list [--all]` (empty/missing store → friendly note, never errors). 8 command
  tests. Commander `.choices()` on `--severity` → completion picks up the values
  automatically.
- **Adversarial rewire** — `buildAdversarialSessionPrompt` /
  `buildAdversarialContext` simplified: the three-state report-write machinery
  (valid/corrupt/missing → append/fail-loud) and the memory-write block are gone.
  The prompt now tells the reviewer to record each finding via `mini findings
  add` and is explicit that it **only reports — never edits/fixes code or moves
  the phase state**. The run report is still read as *context* only.
- **Tool scope** — `ADVERSARIAL_ALLOWED_TOOLS` drops `Edit` and adds
  `Bash(mini findings add:*)`. On the CLI path the reviewer literally cannot edit
  a file; the only write is the scoped CLI call.
- **Docs** — new `docs/non-interactive/findings.md`, a row in `docs/README.md`,
  and the now-accurate `mini adversarial` description in `cli.ts`.

## Verification done mechanically
- Full suite: **1049 tests pass**, `tsc --noEmit` clean, `npm run build` ok.
- Live smoke test in a temp project: `findings add` recorded `1-1` and printed
  `[ok] Finding 1-1 recorded [should-know] → .mini/findings/phase-001.md`; bad
  `--severity` rejected with exit 1 (commander `.choices()`); `findings list`
  rendered the open finding; file format confirmed.
- `mini context adversarial` prints the new store-based prompt (no `## Adversarial
  findings`, no `.mini/run/...` write, contains `mini findings add`).

## Decisions / things to know (unhappy-path review of my own code)
- **Store-only is intentional.** Until the consume phase exists, adversarial
  findings do NOT reach `done`/memory — they live only in `.mini/findings/`
  (the model still prints a `**adversarial: pass/findings/blocked**` status line
  to chat). This is the agreed trade-off, not a regression to fix here.
- **Body-header injection (residual edge).** `parseFindings` treats any line
  matching `## <id> · <severity> · <status>` as a new entry. A finding **title**
  can no longer smuggle one (newlines are collapsed — tested), but a multi-line
  **body** that contains such a line would split into a bogus entry on the next
  `add` (which re-serializes the file). Low risk with a cooperative LLM writer; a
  later `resolve`/hardening phase could escape header-like body lines if it
  matters.
- **Scoped-Bash enforcement is unproven** (same caveat as phase 154). Dropping
  `Edit` is the load-bearing guarantee; the `Bash(... :*)` scope is best-effort.
  See the `verify` item.
- **`/mini:adversarial` slash path** runs in the user's session — its tools can't
  be restricted, so report-only there rests on the prompt instruction alone (same
  CLI-vs-slash asymmetry as before).

## Not done (deliberately deferred, per discussion)
`resolve` (flip open→resolved), `doctor` orphan-check, `undo` integration, and
surfacing open findings inside `next`/`plan`/`do` are all follow-up phases.
