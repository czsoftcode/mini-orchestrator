---
phase: 18
verdict: done
steps:
  - title: "Zjednodušit historii fází v `nextPhase.ts` na jeden řádek"
    status: done
  - title: "Přidat `lastMemoryMd` do `buildNextPhasePrompt`, smazat `graphMd`"
    status: done
  - title: "Aktualizovat `next.ts` — číst `last-memory.md`, smazat `readGraphIfExists`"
    status: done
  - title: "Smazat `graphMd` z `buildDiscussPhasePrompt`, přidat instrukci k read"
    status: done
  - title: "Aktualizovat `discuss.ts` — smazat `readGraphIfExists` a volání grafu"
    status: done
  - title: "Přepsat testy `nextPhase.test.ts` a `discussPhase.test.ts`"
    status: done
---

# Fáze 18 — report z auto session

## Co se povedlo

Všech šest kroků hotovo. Cíl fáze (ušetřit tokeny ve dvou nejdražších promptech) splněn.

### `next` prompt (`nextPhase.ts`)
- Historie fází zkomprimovaná na **jeden řádek na fázi** (`- [status] id. název`). Zmizely řádky `Cíl:`, `Poznámka:` a `Kroky:` — to byl největší žrout tokenů, protože rostl s počtem fází i kroků. `STEP_WORD` a `StepStatus` import už nejsou potřeba, odstraněny.
- `BuildNextPhaseOptions.graphMd` nahrazeno `lastMemoryMd`. Místo celého `graph.md` (~22 kB) se vkládá kompaktní `# Poslední fáze` (shrnutí z `.mini/last-memory.md`), vkládá se podmíněně (může chybět).
- `next.ts`: `readGraphIfExists` přejmenováno/nahrazeno `readLastMemoryIfExists` (čte `LAST_MEMORY_FILE` z `prompts/writeMemory.ts`). Import `GRAPH_FILE` odstraněn. `allowedTools` (Read/Glob/Grep) zůstávají — Claude si může graph přečíst sám, když potřebuje.

### `discuss` prompt (`discussPhase.ts`)
- `graphMd` z promptu úplně pryč. Zrušil jsem i celý parametr `options` a interface `BuildDiscussPhaseOptions` — nikde jinde se netypoval, signatura je teď `buildDiscussPhasePrompt(projectMd, phase)`.
- `projectMd` zůstává v sekci `# Projekt` (je malý).
- Přidaná instrukce: *„Jako úplně první věc si přečti `.mini/graph.md` (Read)…"* — Claude si mapu načte sám, jednotlivé soubory jen když mapa nestačí.
- `discuss.ts`: odstraněna funkce `readGraphIfExists`, její volání i importy `readFile` a `GRAPH_FILE`.

### Testy
- `nextPhase.test.ts`: historie-test přepsán na ověření jednořádkového formátu (+ negativní kontroly, že `Cíl:`/`Poznámka:`/`Kroky:` zmizely). Graph testy nahrazeny last-memory testy.
- `discussPhase.test.ts`: graphMd testy nahrazeny testem, že prompt instruuje ke čtení `.mini/graph.md` a `projectMd` zůstává.
- Staré snapshoty `nextPhase`/`discussPhase` smazány a regenerovány.

`npm run typecheck` čistý. `npm test`: **521 passed**, jediný selhávající test je `src/graph/buildGraph.test.ts`.

## Na co jsem narazil (mimo rozsah fáze)

`buildGraph.test.ts` má **zastaralý snapshot** — očekává starý header grafu (`…přehled TS/TSX souborů`), zatímco `buildGraph.ts` už generuje `…zdrojových souborů (TS/TSX, PHP, Rust)` (změna z fáze 15). Souboru `src/graph/` jsem se vůbec nedotkl (`git status` to potvrzuje), takže jde o pre-existing fail nesouvisející s fází 18. Oprava je triviální (`npm test -- -u` nebo přepsat řádek ve snapshotu), ale nechal jsem ho být, aby fáze 18 zůstala čistá. Doporučuju srovnat samostatně.
