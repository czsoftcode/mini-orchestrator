# Phase 151 — Fable 1M window in statusline

**Goal:** Extend windowForModel() in src/statusline/statusline.ts so the Fable model gets a 1M context window: detect 'fable' in the model name and, as a future-proof fallback, the '[1m]' suffix in the model id; cover both paths plus the unchanged 200k default (e.g. Haiku) with tests in statusline.test.ts.

## Steps
- [done] Fable detection in windowForModel
- [done] Read model.id and detect [1m] suffix
- [done] Tests: Fable, [1m] suffix, 200k default
- [done] Green: npm test + npm run build

## Auto-commit
- Phase 151: Fable 1M window in statusline

## Run report
---
phase: 151
verdict: done
steps:
  - title: "Fable detection in windowForModel"
    status: done
  - title: "Read model.id and detect [1m] suffix"
    status: done
  - title: "Tests: Fable, [1m] suffix, 200k default"
    status: done
  - title: "Green: npm test + npm run build"
    status: done
verify:
  - title: "Statusline shows 1M for a real Fable session"
    detail: "Unit tests cover windowForModel and buildData, but I could not observe a live Claude Code status line. In a Fable session the segment should read '1M' with a sensible percentage instead of '200k'."
---

# Phase 151 — report from the auto session

Both detection paths landed in `src/statusline/statusline.ts`:

- `windowForModel()` now returns 1M when the display name contains `fable`
  (any version — Fable has shipped with a 1M window from the start, so no
  version gate like Opus needs).
- The function gained an optional second parameter `id`; an id containing
  `[1m]` (case-insensitive) returns 1M immediately, regardless of the display
  name. This is the future-proof path: new long-context models are recognized
  without a code change as long as Claude Code keeps the `[1m]` suffix in
  `model.id`.
- `StatusInput.model` gained `id?: string` and `buildData()` passes it through.

Tests added (5 new cases): Fable 5 / version-less Fable → 1M; unknown name
with `[1m]` id → 1M (both lower- and upper-case suffix); an id *without* the
suffix stays 200k; `buildData` reads `model.id` from the status JSON. Existing
defaults (Haiku, empty input → 200k) were already covered and still pass.

Suite: 957 tests green, `npm run build` clean.

Known limitation (accepted in planning): if Claude Code ever drops the `[1m]`
suffix from `model.id`, only the name-based detection remains and it goes
stale as new models ship — the `used > window` auto-escalation in `buildData`
stays as the safety net.

No real decision crossroads — the implementation followed the plan; no ADR
needed.
