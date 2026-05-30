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
