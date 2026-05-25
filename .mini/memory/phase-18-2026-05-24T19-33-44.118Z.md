# Fáze 18 — Zjednodušení workflow

**Cíl:** CO se dá ještě zjednodušit, aby se štřili tokeny a projekt zbytečně nebobtnal

## Kroky
- [hotovo] Zjednodušit historii fází v `nextPhase.ts` na jeden řádek
- [hotovo] Přidat `lastMemoryMd` do `buildNextPhasePrompt`, smazat `graphMd`
- [hotovo] Aktualizovat `next.ts` — číst `last-memory.md`, smazat `readGraphIfExists`
- [hotovo] Smazat `graphMd` z `buildDiscussPhasePrompt`, přidat instrukci k read
- [hotovo] Aktualizovat `discuss.ts` — smazat `readGraphIfExists` a volání grafu
- [hotovo] Přepsat testy `nextPhase.test.ts` a `discussPhase.test.ts`

## Auto-commit
- Fáze 18: Zjednodušení workflow (`970405ef476d2e9375a1395b0972799610e055f2`)

## Diskuse
# Fáze 18 — Zjednodušení workflow

## Záměr

Snížit počet tokenů posílaných do Claude ve dvou nejdražších promptech (`next` a `discuss`), aniž by se ztratil užitečný kontext.

## Klíčová rozhodnutí

### `next` prompt
- **Odstranit `graph.md` z promptu.** `next.ts` přestane číst a vkládat `graph.md` (~22 kB). Pokud Claude bude potřebovat hlubší kontext, může si soubor přečíst sám přes Read (allowedTools zůstávají).
- **Přidat `last-memory.md` jako "# Poslední fáze".** `next.ts` přečte `.mini/last-memory.md` a vloží ho do promptu místo kompletní historie.
- **Historii fází zkomprimovat.** Místo `Cíl:`, `Kroky:`, `Poznámka:` u každé fáze — jen `- [status] id. název`. Celá fáze na jeden řádek.

### `discuss` prompt
- **Odstranit `graph.md` z promptu.** `discuss.ts` přestane číst a předávat `graphMd`. `BuildDiscussPhaseOptions.graphMd` se odstraní.
- **Claude dostane instrukci: přečti `.mini/graph.md` jako první věc** před otevíráním jiných souborů. Jednotlivé zdrojové soubory jen pokud graph nestačí.
- **`projectMd` zůstává** (je triviálně malý, dává základní kontext bez graph.md).

## Pozor na

- `buildNextPhasePrompt` má snapshot/unit testy v `nextPhase.test.ts` — testují `graphMd` parametr. Parametr se odstraní, testy se přepíší.
- `buildDiscussPhasePrompt` má testy v `discussPhase.test.ts` — testují `graphMd` v `options`. Parametr se odstraní, testy se přepíší.
- `last-memory.md` nemusí existovat (nový projekt nebo fáze 17 ještě neproběhla) — vkládat podmíněně, jako optional.
- `readGraphIfExists` funkce existuje duplicitně v `next.ts` i `discuss.ts` — v `discuss.ts` se smaže úplně, v `next.ts` zůstane (Claude si ji může zavolat přes tool, ale funkce sama se nepoužívá v promptu — lze smazat z obou a nechat na Claudovi ať si graph.md sám přečte přes Read tool).

## Run report
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
