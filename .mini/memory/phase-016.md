# Fáze 16 — Discuss vloží graph.md místo projectMd

## Co se udělalo

- `src/prompts/discussPhase.ts`: `buildDiscussPhasePrompt` dostala volitelný třetí parametr `options: BuildDiscussPhaseOptions` s polem `graphMd?`; pokud je `graphMd` po `trim()` neprázdný, vloží se do sekce `# Projekt` místo `projectMd`.
- `src/commands/discuss.ts`: přidán lokální helper `readGraphIfExists(cwd)` (pokus o `readFile(GRAPH_FILE)`, při chybě vrací `undefined`); výsledek se předává do `buildDiscussPhasePrompt`.
- `src/prompts/discussPhase.test.ts`: tři nové testy — (1) graf nahradí projectMd (snapshot), (2) prázdný/whitespace `graphMd` zůstane u projectMd, (3) `graphMd` se trimuje.
- `src/prompts/__snapshots__/discussPhase.test.ts.snap`: přidán jeden nový snapshot; staré snapshoty beze změny (builder je beze `graphMd` identický).
- Signatura `buildDiscussPhasePrompt` zpětně kompatibilní — `options` má default `{}`.

## Klíčová rozhodnutí

- **Graf se vkládá do těla sekce `# Projekt`**, nadpis sekce zůstává. Výsledkem je `# Projekt\n# Graf projektu\n...` — vnořené nadpisy, ale LLM si s tím poradí. Alternativa (přejmenovat `# Projekt` na `# Mapa projektu`) nebyla požadována.
- **Fallback na `projectMd`** když `graph.md` neexistuje nebo je prázdný — nulová změna chování pro projekty bez grafu.
- **`readGraphIfExists` jako lokální helper** v `discuss.ts`, nikoliv sdílená utilita — stejný vzor jako `next.ts`; sdílení by bylo předčasná abstrakce.
- **`GRAPH_FILE` konstanta** importovaná z `buildGraph.ts` místo inline řetězce — single source of truth pro cestu k souboru.

## Otevřené konce

- **Pre-existující selhání testů v `dist/`**: `vitest run` bez omezení adresáře spouští i zkompilované testy v `dist/` a tam selhává `dist/graph/buildGraph.test.js` na zastaralém snapshotu z doby před fází 15. Nesouvisí s touto fází, ale zatěžuje `npm test`. Řešení: přidat `dist` do `vitest.config` `exclude` nebo před testy smazat/přebuildovat `dist/`.
- Sekce `# Projekt` v promptu obsahuje vnořený `# Graf projektu` — pokud by budoucí fáze chtěla čistší strukturu, je potřeba upravit šablonu v `discussPhase.ts`.
