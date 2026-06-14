---
phase: 162
verdict: done
steps:
  - title: "Module + resolveRange signature"
    status: done
  - title: "Reject mixed phase+ref and incomplete bounds"
    status: done
  - title: "Resolve phase bounds via loadPhase + preSha"
    status: done
  - title: "Resolve git-ref bounds via rev-parse"
    status: done
  - title: "Reject empty range"
    status: done
  - title: "Unit tests: every failure path + happy paths"
    status: done
---

# Phase 162 — report from the auto session

## What was built

New pure helper `src/range.ts` exporting `resolveRange(cwd, input)` and the
types `RangeInput` / `RangeResult`. It resolves a review range into
`{ fromSha, toSha }` in two mutually exclusive modes:

- **Phase mode** (`--from-phase N` / `--to-phase M`): `fromSha = preSha(N)`,
  `toSha = preSha(M+1)` via `loadPhase`, or current HEAD when M+1 doesn't exist
  (M is the last phase).
- **Ref mode** (`--from` / `--to`): plain git refs, each verified with
  `git rev-parse --verify <ref>^{commit}` through `runGit`.

It returns a discriminated union `{ ok: true, fromSha, toSha } | { ok: false,
error }` and **never throws** — deliberately consistent with `git.ts`, whose
wrapper never throws either; the caller (slices 4/7, 5/7) decides whether to
print `error` and exit.

## Failure paths covered (all hard-fail with a message)

mixed phase+ref flags · no range given · phase range missing a bound · ref
range missing a bound · blank ref string treated as absent · inverted phase
range (M < N) · start phase not found · start phase without `preSha` · phase
M+1 exists but without `preSha` · invalid/unknown git ref · empty range (both
bounds resolve to the same commit, checked in both modes).

## Verification

- `src/range.test.ts` — 15 tests on a real temp git repo with real commits and
  real phase files (`savePhase`); covers every failure path above plus three
  happy paths (N..M not-last, M-is-last→HEAD, ref passthrough).
- Full suite: 81 files / 1115 tests green. `tsc --noEmit`: 0 errors.

## Things to be aware of (scope / assumptions, not bugs)

- **`toSha = preSha(M+1)` assumes no untracked commits between phases.** If
  commits landed between phase M's commit and phase M+1's commit that mini
  didn't record, the diff will include them. This is inherent to the chosen
  definition from the backlog item, not a defect of the helper — pointed out so
  the prompt builder (3/7) can decide whether to warn the reviewer.
- **"M is last" = `loadPhase(M+1) === null`.** On a gap in phase numbering
  (e.g. 162 and 164 exist but not 163) this could behave unexpectedly. This
  project keeps phases contiguous, so it isn't guarded.
- **I added an inverted-range check (M < N → error)** beyond the backlog's
  explicit list. It's cheap, needs no git, and catches an obvious user mistake;
  flagging it because it's a small scope addition.
- **Nothing wires this up yet.** No command emits a resolved range — that is
  slices 4/7 (interactive `mini adversarial-project`) and 5/7 (`mini context
  adversarial-project`). After this phase the helper exists and is tested, but
  no code path calls it.

No `/mini:decision` needed: the only real design choice (union vs. throw) was
settled by an existing, clearly dominant convention in the repo (`git.ts`), not
a weighed-and-rejected alternative worth recording.
