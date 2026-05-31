---
phase: 75
verdict: done
steps:
  - title: "writeMemory.ts → AJ"
    status: done
  - title: "autoPhase.ts → AJ"
    status: done
  - title: "Doplnit slovníček + ověřit"
    status: done
---

# Fáze 75 — report z auto session

## Co se udělalo
- **`writeMemory.ts` přeložen do angličtiny** — celá próza, `STEP_WORD`, bloky
  (Finished phase / How to proceed / Output format) i šablona memory sekcí
  (Co se udělalo→What was done, Klíčová rozhodnutí→Key decisions, Otevřené konce→Loose ends).
  Konstanty cest (`MEMORY_DIR`, `LAST_MEMORY_FILE`, `memoryPath`) beze změny.
- **`autoPhase.ts` přeložen do angličtiny** — projekt/notes/retry/progress bloky,
  `STEP_WORD`, próza kolem reportu, YAML komentáře a placeholdery. **Zachován**
  strojový kontrakt YAML reportu: pole `phase`/`verdict`/`steps`/`title`/`status`/
  `verify`/`detail` i enum hodnoty (`done`/`skipped`/`blocked`/`todo`/`partial`),
  které parsuje `state/runReport.ts`. Příkaz `mini do --apply --step-done` beze změny.
- **Slovníček `docs/i18n-glossary.md` rozšířen** o nové termíny (Finished phase,
  Retry, Tracking step progress, memory sekce, …).
- Aktualizovány aserce v `writeMemory.test.ts` a `autoPhase.test.ts`; přegenerováno
  10 snapshotů.
- **Návazné snapshoty/aserce v jiných souborech**: `tokens/measure.test.ts`
  (2 snapshoty měření tokenů promptů přegenerovány) a `commands/context.test.ts`
  (2 aserce na auto-prompt přeloženy — `Report at the end of the session`,
  `# Phase notes (from discussion)`), protože `mini context do` renderuje právě
  `buildAutoPhasePrompt`.

## Ověření (strojově)
- Před překladem ověřeno, na co se v memory/reportu skutečně váže parser:
  `summarizeMemoryForNext` klíčuje na `## Diskuse`/`## Run report`/`pozor`
  (mechanický producent), NE na šablonu z promptu → šablonu memory sekcí bylo
  bezpečné přeložit. YAML report parsuje `runReport.ts` → pole + enum ponechány.
- `npm test` → 50 souborů, 651 testů, vše zelené.
- `npm run build` → tsc + copy-assets bez chyb.

## Na co dát pozor / otevřené
- Po této fázi je `mini context do`/`auto` (interaktivní `/mini:do`, `/mini:auto`)
  z větší části anglicky, ale **wrapper kolem** stále jede přes `sessionContext.ts`,
  který zůstává česky.
- **Zbývá poslední „graph-hint" balík:** `graphHint.ts` (sdílený) + `discussPhase.ts`
  + velký `sessionContext.ts`. Je vhodné je přeložit v jedné fázi, aby nevznikl šev
  (anglický graph hint v českém promptu nebo naopak). Tím se překlad instrukcí dokončí.
- Drobnost: Claude-cesta zápisu memory teď generuje memory s anglickými nadpisy,
  zatímco mechanický producent (`commands/writeMemory.ts`, mimo rozsah překladu promptů)
  je dál česky. Nikde se to neparsuje, takže bez funkčního dopadu.
