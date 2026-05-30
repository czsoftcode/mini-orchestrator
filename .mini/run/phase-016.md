---
phase: 16
verdict: done
steps:
  - title: "Přidat volitelný `graphMd` parametr do `buildDiscussPhasePrompt`"
    status: done
  - title: "Použít `graphMd` v promptu místo `projectMd`, pokud je předán"
    status: done
  - title: "V `discuss.ts` načíst `.mini/graph.md` a předat ho do prompt builderu"
    status: done
  - title: "Přidat snapshot test pro případ s `graphMd`"
    status: done
  - title: "Aktualizovat existující snapshoty (`vitest -u`)"
    status: done
---

# Fáze 16 — report z auto session

## Co se povedlo

Všechny kroky fáze jsou hotové, cíl splněn.

- **`buildDiscussPhasePrompt`** má nový volitelný třetí parametr `options: BuildDiscussPhaseOptions` s polem `graphMd?`. Když je `graphMd` po `trim()` neprázdný, vloží se do sekce `# Projekt` místo `projectMd`; jinak se použije `projectMd` (fallback). Signatura zůstává zpětně kompatibilní — `options` má default `{}`.
- **`discuss.ts`** teď načítá `.mini/graph.md` přes nový lokální helper `readGraphIfExists(cwd)` (stejný vzor jako v `next.ts`) a předává obsah do prompt builderu. Pokud graf neexistuje, helper vrací `undefined` a prompt spadne zpět na `projectMd`.
- **Testy**: přidal jsem tři nové testy do `discussPhase.test.ts` — (1) graf nahradí projectMd (se snapshotem), (2) prázdný/whitespace `graphMd` spadne zpět na projectMd, (3) `graphMd` se trimuje. Nový snapshot byl zapsán přes `vitest -u`.

## Poznámky / na co jsem narazil

- **Interpretace „místo projectMd“**: graf vkládám do těla sekce `# Projekt` (nadpis sekce zůstává). Protože `graph.md` má vlastní nadpis `# Graf projektu`, ve výsledném promptu vznikne `# Projekt` a hned pod ním `# Graf projektu`. Je to validní markdown a LLM si s tím poradí; pokud bys chtěl nadpis sekce úplně nahradit (např. `# Mapa projektu` bez vnořeného `# Projekt`), je to drobná úprava jedné šablony.
- **Existující snapshoty se nezměnily** — beze `graphMd` vrací builder identický výstup jako dřív, takže `vitest -u` jen zapsal jeden nový snapshot a staré nechal beze změny.
- **Pre-existující selhání testu (nesouvisí s fází 16)**: `npm test` / `vitest run` bez omezení adresáře spouští i zkompilované testy v `dist/` a tam selhává `dist/graph/buildGraph.test.js` na snapshotu (`renderGraphMarkdown`). Je to zastaralý build z doby před fází 15 (starý text „TS/TSX souborů“ vs. nový „zdrojových souborů (TS/TSX, PHP, Rust)“). Ověřil jsem přes `git stash`, že selhává i na čisté `main` bez mých změn. Doporučení do budoucna: buď přidat `dist` do vitest `exclude`, nebo `dist/` před testy přebuildovat/smazat. **Všech 259 testů v `src/` prochází**, `tsc --noEmit` je čistý.
