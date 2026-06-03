# Phase 122 — Flag value completion

**Goal:** Extend the bash/zsh completion scripts to complete a flag's enumerated values when the previous word is such a flag (e.g. 'mini done --bump <Tab>' offers none/patch/minor/major). Make commander the source of truth by giving --bump an explicit .choices([...]) and deriving the value sets from option.argChoices, so they never drift. Verifiable via snapshot tests.

## Steps
- [done] --bump uses commander .choices()
- [done] Renderer completes flag values
- [done] CLI derives choices; tests; docs

## Auto-commit
- Phase 122: Flag value completion

## Run report
---
phase: 122
verdict: done
steps:
  - title: "--bump uses commander .choices()"
    status: done
  - title: "Renderer completes flag values"
    status: done
  - title: "CLI derives choices; tests; docs"
    status: done
---

# Phase 122 — report from the auto session

Extended `mini completion` so the bash/zsh scripts now complete a flag's
enumerated *values*, not just flag names.

## What was done
- **`src/cli.ts`** — the `--bump` option on `done` and `auto` is now defined via
  `new Option(...).choices(['none','patch','minor','major'])` (replacing the
  custom `parseBumpLevel` validator, which was removed). Commander now both
  validates the value (`--bump bogus` → a clear "Allowed choices are …" error)
  and exposes the set via `option.argChoices`. The completion action reads
  `argChoices` into each flag's `values`.
- **`src/completion/render.ts`** — flag shape is now `FlagSpec { name; values? }`.
  Both renderers gained a value branch keyed on `"<cmd>:<prevWord>"` that
  completes the choices when the previous word is a flag with a known value set,
  placed before the flag-name / file-fallback branches. Renderers stay pure.
- **`src/commands/completion.ts`** — signature already took `CommandSpec[]`; now
  carries the richer flag shape transparently.
- **Tests** — `render.test.ts` / `completion.test.ts` updated to the new shape
  with value-completion cases and refreshed inline snapshots.
- **Docs** — `docs/non-interactive/completion.md` and the README row now mention
  flag-value completion and its scope (only fixed-choice flags, currently
  `--bump`).

## Verification (all mechanical, done here)
- `npm run typecheck` clean; full suite green (868 tests).
- Generated + sourced the real bash script (`bash -n` clean) and exercised it:
  `mini done --bump <Tab>` → `none patch minor major`, `--bump m` → `minor major`,
  `mini auto --bump` likewise; flag-name completion (`mini done --`) and command
  completion still work.
- Confirmed the new `.choices()` validation: `mini done --apply --bump bogus`
  exits with "option '--bump <level>' argument 'bogus' is invalid. Allowed
  choices are none, patch, minor, major."

## Notes / limitations
- Only flags with a fixed choice set get value completion (just `--bump` today);
  free-form values (titles, paths, numbers) fall back to file completion. New
  fixed-choice flags get completion for free if defined via `.choices()`.
- zsh again only snapshot/structure-tested (`zsh` not installed here); mirrors
  the verified bash logic.
