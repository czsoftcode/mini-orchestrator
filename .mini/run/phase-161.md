---
phase: 161
verdict: done
steps:
  - title: "Add project to FindingSource type and array"
    status: done
  - title: "Round-trip test for source: project"
    status: done
  - title: "Regression guard: defaults and existing sources unchanged"
    status: done
  - title: "Full test suite + typecheck green"
    status: done
---

# Phase 161 — report from the auto session

## What was done

Slice 1/7 of the `adversarial-project` series: the findings store now knows the
`project` source. Purely additive — no behaviour change for `adversarial` /
`verify`.

- `src/state/findingsStore.ts`: widened the `FindingSource` union (line 56) to
  `'adversarial' | 'verify' | 'project'` and appended `'project'` to the
  `FINDING_SOURCES` array (line 61). `DEFAULT_FINDING_SOURCE` stays
  `adversarial`. `isFindingSource('project')` now returns `true`, so
  `mini findings add --source project` will be accepted (the validation in
  `findings.ts` already goes through `isFindingSource` — no change needed there).
- `src/state/findingsStore.test.ts`: extended the `isFindingSource` test to
  accept `project`, and added a `round-trips a project-sourced finding` case that
  asserts both the literal `**Source:** project` line is emitted and the full
  parse → serialize round-trip is identity.

## On the regression guard (step 3)

No new tests were written for this step on purpose. The guarantees it asks for
already have dedicated, pre-existing tests that the widened union must not break:

- `defaults source to adversarial for an old file with no **Source:** line`
- `round-trips a verify-sourced finding` + the adversarial round-trips
- `ignores an unknown **Source:** value and falls back to the default`

All of them stay green, which *is* the regression guard. Adding duplicates would
be noise.

## Verification (all mechanical, done here)

- `npm run build` — green.
- `npx tsc -p tsconfig.build.json --noEmit` — clean; the widened union forced no
  exhaustive-switch fixes (a grep confirmed `source` is only ever rendered as a
  string, never `switch`-ed on).
- `npx vitest run` — 80 files, 1100 tests, all pass.

## Watch out for / scope notes

- This phase deliberately does **not** touch finding 160-2 (an unknown
  `--source` value is silently downgraded to `adversarial` on re-serialize).
  That is a separate open finding, not part of slice 1/7. With `project` now a
  known source, the set of values that hit that downgrade path is just smaller.
- Nothing here wires up the actual `adversarial-project` command, range
  resolution, prompt, or slash command — those are slices 2/7–7/7. After this,
  `--source project` is accepted and durable, but no code path emits it yet.

No `/mini:decision` needed — there was no weighed-and-rejected alternative; the
change is the obvious minimal one.
