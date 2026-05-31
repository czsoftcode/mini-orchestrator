# Fáze 76 — Dokončení překladu instrukcí do AJ

**Cíl:** Přeložit do angličtiny graphHint.ts (sdílený), discussPhase.ts a sessionContext.ts a aktualizovat všechny návazné snapshoty/aserce (i v tokens/measure a commands/context); strojové kontrakty beze změny; npm test a build zelené — čímž jsou všechny mini prompty anglicky.

## Kroky
- [hotovo] graphHint.ts → AJ
- [hotovo] discussPhase.ts → AJ
- [hotovo] sessionContext.ts → AJ
- [hotovo] Sladit summarizer last-memory
- [hotovo] Návazné aserce + snapshoty
- [hotovo] Doplnit slovníček + ověřit

## Auto-commit
- Fáze 76: Dokončení překladu instrukcí do AJ

## Run report
---
phase: 76
verdict: done
steps:
  - title: "graphHint.ts → AJ"
    status: done
  - title: "discussPhase.ts → AJ"
    status: done
  - title: "sessionContext.ts → AJ"
    status: done
  - title: "Sladit summarizer last-memory"
    status: done
  - title: "Návazné aserce + snapshoty"
    status: done
  - title: "Doplnit slovníček + ověřit"
    status: done
---

# Fáze 76 — report z auto session

Závěrečná fáze překladu instrukcí. Po ní jsou **všechny** buildery v `src/prompts/`
anglicky.

## Co se udělalo
- **`graphHint.ts`** — sdílený `GRAPH_USAGE_HINT` přeložen do AJ. Tím zmizel šev:
  jeho konzumenti (next/plan/discuss/sessionContext) jsou teď všichni anglicky.
- **`discussPhase.ts`** — próza + `STEP_WORD` + šablona poznámek
  (`## Záměr`→`## Intent`, `## Klíčová rozhodnutí`→`## Key decisions`,
  `## Pozor na`→`## Watch out for`).
- **`sessionContext.ts`** — všechny 4 buildery (next/plan/done/verify session)
  vč. `## Nálezy z verify`→`## Verify findings`. Zachovány příkazy
  (`mini … --apply`, `--accept-verify`, `--push`, `--bump`, `--step-done`) i
  keepachangelog termíny (`## [Unreleased]`, `### Added/Changed/Fixed`).
- **Sladěn summarizer `commands/writeMemory.ts`** (dle dohody s uživatelem):
  matcher diskuze rozšířen na `/pozor|watch out/i`, `RUN_WATCH_RE` na
  `/pozor|nález|další fáz|watch out|finding|next phase/i` — chytá nové anglické
  nadpisy i starší českou paměť. Fixtury + aserce v `commands/writeMemory.test.ts`
  přepnuty na anglické nadpisy.
- **Slovníček `docs/i18n-glossary.md`** doplněn (discuss/session/verify termíny,
  sekce diskuzních poznámek s pozn. o parseru) a sekce „švy migrace" nahrazena
  „Stav migrace: dokončeno".

## Ověření (strojově)
- Aktualizovány aserce + snapshoty napříč: `discussPhase.test.ts`,
  `sessionContext.test.ts`, `commands/writeMemory.test.ts`, `commands/context.test.ts`,
  `tokens/measure.test.ts` a (kvůli vloženému `GRAPH_USAGE_HINT`) i
  `nextPhase.test.ts` + `planPhase.test.ts`.
- `npm test` → 50 souborů, 651 testů, vše zelené.
- `npm run build` → tsc + copy-assets bez chyb.

## Na co dát pozor / otevřené
- **Překlad instrukcí je kompletní.** Záměrně česky zůstává jen interní produkce
  paměťové koláže `buildPhaseMemoryMarkdown` (`## Diskuse`/`## Run report`/`## Kroky`/
  `## Poznámka uživatele`/`## Auto-commit`/`**Cíl:**`) — není to prompt, je to
  skládání dat a `summarizeMemoryForNext` se na ty kotvy váže. Případný překlad je
  samostatná změna.
- Drobnost (dogfooding): historické soubory tohoto repa v `.mini/` (memory, discuss,
  codebase) jsou z dřívějška česky — bez funkčního dopadu, nové projekty jedou
  konzistentně anglicky.
