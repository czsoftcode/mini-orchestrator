---
phase: 32
verdict: done
steps:
  - title: "buildGraph.ts — nový layout (adresář + index): nahradit GRAPH_FILE za GRAPH_DIR (.mini/graph) + GRAPH_INDEX (.mini/graph.json); vyčlenit per-file render jedné ## sekce z renderGraphMarkdown a zapsat .mini/graph/<zdroj>.md zrcadlící strom zdrojáků + graph.json index ({version, generatedAt, files:[{path, graphFile, exports:[names]}]}); atomicita přes .mini/graph.tmp/ + graph.json.tmp → swap (smazat starý .mini/graph/ + rename), starý graph.md smazat; BuildGraphResult → {indexFile, graphDir, fileCount, files}. Ověření: přepsaný buildGraph.test.ts zelený — layout na disku, obsah indexu vč. exportů, atomicita bez .tmp zbytků, smazaný graph.md."
    status: done
  - title: "Konzumenti buildGraph (map.ts, done.ts, cli.ts): map loguje cestu indexu + počet souborů; regenerateGraph v done napojit na nový result a zachovat best-effort (chyby jen warning, nikdy nehází); CLI popis příkazu map aktualizovat z graph.md na nový layout. Ověření: přepsaný map.test.ts + existující testy done zelené."
    status: done
  - title: "Prompty discussPhase + sessionContext na index + selektivní čtení: přeformulovat tak, aby vstupní bod byl .mini/graph.json (index s názvy exportů) a per-file soubory z .mini/graph/ se četly cíleně podle indexu, ne celý graf najednou. Ověření: aktualizovaný snapshot discussPhase, testy promptů zelené."
    status: done
  - title: "Git tracking + plné ověření: git rm --cached .mini/graph.md, natrackovat .mini/graph/ + .mini/graph.json; npm run typecheck/build/test; ruční e2e přes lokální build (mini map → ověřit layout adresáře, obsah graph.json, zmizelý graph.md). Ověření: vše prochází, layout na disku sedí."
    status: done
---

# Fáze 32 — report z auto session

Cíl splněn: monolitický `.mini/graph.md` je rozsekaný do adresáře `.mini/graph/`
(jeden markdown na zdrojový soubor, zrcadlí strom zdrojáků) + lehký index
`.mini/graph.json` s názvy exportů. `mini map` i regenerace v `done` zapisují
nový layout; prompty `discussPhase` a `sessionContext` navádějí Claude, ať začne
indexem a per-file mapy čte selektivně.

## Co vzniklo / změnilo se

- **`src/graph/buildGraph.ts`** přepsán na layout adresář + index:
  - konstanty `GRAPH_DIR` (`.mini/graph`), `GRAPH_INDEX` (`.mini/graph.json`),
    `LEGACY_GRAPH_FILE` (`.mini/graph.md`), `GRAPH_INDEX_VERSION = 1`,
  - nové typy `GraphIndexEntry` (`{ path, graphFile, exports[] }`) a `GraphIndex`
    (`{ version, generatedAt, files[] }`),
  - `BuildGraphResult` → `{ indexFile, graphDir, fileCount, files }`,
  - `renderGraphMarkdown(files)` nahrazen `renderFileGraph(file)` — renderuje
    `## cesta` sekci jednoho souboru (helpery renderImport/renderExport/
    renderSignature beze změny),
  - nový `writeGraphLayout`: staví kompletní layout do `.mini/graph.tmp/` +
    `graph.json.tmp`, pak atomický swap (rm starého `graph/` + rename), nakonec
    smaže legacy `graph.md`. Plný rebuild = žádné osiřelé soubory, žádný prune.
- **`src/commands/map.ts`** — logy/popis na `GRAPH_DIR` + `GRAPH_INDEX`.
- **`src/commands/done.ts`** — `regenerateGraph` napojen na nový result
  (`GRAPH_DIR`), best-effort chování zachováno (chyby jen warning, nikdy nehází);
  doc komentáře aktualizovány.
- **`src/cli.ts`** — popis příkazu `map` na nový layout.
- **Prompty**: `discussPhase.ts` a `sessionContext.ts` přeformulovány — vstupní
  bod `.mini/graph.json` (index s exporty), per-file mapy z `.mini/graph/` číst
  **cíleně**, ne celý graf najednou.
- **`.mini/.gitignore`** — přidán ignore transientních `graph.tmp/` a
  `graph.json.tmp` (pojistka po pádu uprostřed zápisu).
- Testy: `buildGraph.test.ts` přepsán (layout, index vč. exportů, atomicita bez
  `.tmp`, smazaný `graph.md`, prune po smazaném zdrojáku, prázdný projekt),
  `map.test.ts` a `done.test.ts` na nový layout, `discussPhase.test.ts` na
  `graph.json`/`graph/`, snapshot `renderFileGraph` přegenerován.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **419 testů, 35 souborů** zelených.
- E2E přes lokální build (`node dist/cli.js map`) přímo v tomhle projektu:
  - vygenerováno 86 per-file map v `.mini/graph/` (strom zrcadlí zdrojáky),
  - `graph.json`: `version: 1`, `generatedAt`, 86 záznamů `{path, graphFile, exports}`,
  - starý `.mini/graph.md` smazán, žádné `.tmp` zbytky v `.mini/`.
- Git: `git rm --cached .mini/graph.md` (staged `D`), natrackováno
  `.mini/graph.json` + 86 souborů v `.mini/graph/`.

## Pozor na (pro mini done / nasazení)

- **Globální `mini` je starší verze** (0.1.0) a nový layout/`map` nezná — tahle
  session i `mini done` jedou přes něj. Reálný přínos se projeví až po obnovení
  globální instalace z nového buildu. Žádná migrace ale netřeba: graf je
  derivace, takže příští `mini map` (z nového buildu) prostě přepíše layout
  a smaže `graph.md` (ověřeno e2e v tomto projektu).
- **Žádný `mini migrate` pro graf** — vědomé rozhodnutí z diskuse (na rozdíl od
  state.json se graf neverzuje, jen regeneruje).
