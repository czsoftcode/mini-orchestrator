---
phase: 80
verdict: done
steps:
  - title: "Přeložit výstup buildPhaseMemoryMarkdown"
    status: done
  - title: "Sladit konzumenta summarizeMemoryForNext na EN i starou CZ paměť"
    status: done
  - title: "Upravit testy writeMemory.test.ts"
    status: done
  - title: "Ověřit build a testy"
    status: done
---

# Phase 80 — report from the auto session

## Co se povedlo

Generátor paměti fáze (`src/commands/writeMemory.ts`) píše `.mini/memory/phase-XXX.md`
nově anglicky, se zachováním čtení staré české paměti.

- **Producent `buildPhaseMemoryMarkdown`**: nadpisy `# Phase N — …`, `**Goal:**`,
  `(not specified)`, `## Steps`, `## User's note`, `## Auto-commit`. `STEP_WORD` →
  `done`/`doing`/`todo`/`skipped`. Konstanta `DISCUSS_SECTION` → `Discussion`
  (`RUN_REPORT_SECTION` byl anglicky už dřív). Přeloženy i všechny komentáře/JSDoc
  a runtime hlášky (`log.warn`/`log.hint`/`log.dim` — „Failed to write memory…",
  „Continuing without a memory record.", „Writing memory … via Claude …" atd.),
  `…(truncated)`.
- **Konzument `summarizeMemoryForNext`**: `indexOfSection` přepsán na seznam názvů
  a discuss kotvu hledá jako `['Discussion', 'Diskuse']` — **čte EN i starou CZ
  paměť**. Nový alias `DISCUSS_SECTION_LEGACY = 'Diskuse'`. Matchery byly
  dvojjazyčné už dřív (`/pozor|watch out/i`, `RUN_WATCH_RE`), ponechány.
- **Testy `writeMemory.test.ts`**: asserty + fixtury + popisy na angličtinu;
  **přidán test zpětné kompatibility** — `summarizeMemoryForNext` na čistě české
  archivní paměti (`## Diskuse` + `## Pozor na` + `## Nález pro další fázi`)
  správně nechá hlavu a vytáhne „pozor"/„nález" sekce.

`phase-XXX.json` (savePhase v `state/store.ts`) **beze změny** — drží jen
uživatelský `title`/`goal` (jazyk = jak uživatel píše) a anglické klíče/stavy.

## Ověření (strojově, vše prošlo)

- `npm run build` — zelený.
- `npm test` — **652 testů / 50 souborů zelených** (+1 oproti minule: nový legacy
  test).
- Smoke (`node` render z dist): `buildPhaseMemoryMarkdown` i
  `summarizeMemoryForNext` produkují anglické nadpisy; shrnutí vytahuje
  `## Watch out for` + `## Findings for next phase` a zahazuje kotvy bloků.
- Grep diakritiky v `writeMemory.ts` — čistý (kromě záměrné dvojjazyčné části
  `RUN_WATCH_RE` `pozor|nález|další fáz`).

## Poznámky / otevřené

- Existující `.mini/memory/*.md` a `.mini/last-memory.md` v tomto repu zůstávají
  česky (archiv minulých fází) — `summarizeMemoryForNext` je díky legacy aliasu
  čte dál. Nová paměť (od této fáze dál) bude anglicky.
- Glossary `docs/i18n-glossary.md` ještě tvrdí, že překlad `buildPhaseMemoryMarkdown`
  je „samostatná změna mimo překlad instrukcí" — to je teď hotovo; drobná
  aktualizace „Stavu migrace" by se hodila v některé z dalších i18n fází (mimo
  záběr této).
- Zbývá (dle glossary): lifecycle příkazy (do/done/next/plan/auto/discuss/context),
  `state/*` (vč. `SCOPE_LABELS`), graph mappery (`graph/*`).
