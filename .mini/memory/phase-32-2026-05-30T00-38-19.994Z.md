# Fáze 32 — Štíhlý graf: adresář + index

**Cíl:** Rozdělit monolitický .mini/graph.md do adresáře .mini/graph/ se souborem na zdrojový soubor a lehkým indexem .mini/graph.json (cesta zdrojáku → cesta v graphu); mini map i regenerace v done zapisují tento layout a prompty čtoucí graf (discussPhase, sessionContext) navedou Claude, aby si přes index selektivně načítal jen potřebné soubory místo celého grafu.

## Kroky
- [hotovo] buildGraph.ts — nový layout (adresář + index): nahradit GRAPH_FILE za GRAPH_DIR (.mini/graph) + GRAPH_INDEX (.mini/graph.json); vyčlenit per-file render jedné ## sekce z renderGraphMarkdown a zapsat .mini/graph/<zdroj>.md zrcadlící strom zdrojáků + graph.json index ({version, generatedAt, files:[{path, graphFile, exports:[names]}]}); atomicita přes .mini/graph.tmp/ + graph.json.tmp → swap (smazat starý .mini/graph/ + rename), starý graph.md smazat; BuildGraphResult → {indexFile, graphDir, fileCount, files}. Ověření: přepsaný buildGraph.test.ts zelený — layout na disku, obsah indexu vč. exportů, atomicita bez .tmp zbytků, smazaný graph.md.
- [hotovo] Konzumenti buildGraph (map.ts, done.ts, cli.ts): map loguje cestu indexu + počet souborů; regenerateGraph v done napojit na nový result a zachovat best-effort (chyby jen warning, nikdy nehází); CLI popis příkazu map aktualizovat z graph.md na nový layout. Ověření: přepsaný map.test.ts + existující testy done zelené.
- [hotovo] Prompty discussPhase + sessionContext na index + selektivní čtení: přeformulovat tak, aby vstupní bod byl .mini/graph.json (index s názvy exportů) a per-file soubory z .mini/graph/ se četly cíleně podle indexu, ne celý graf najednou. Ověření: aktualizovaný snapshot discussPhase, testy promptů zelené.
- [hotovo] Git tracking + plné ověření: git rm --cached .mini/graph.md, natrackovat .mini/graph/ + .mini/graph.json; npm run typecheck/build/test; ruční e2e přes lokální build (mini map → ověřit layout adresáře, obsah graph.json, zmizelý graph.md). Ověření: vše prochází, layout na disku sedí.

## Auto-commit
- Fáze 32: Štíhlý graf: adresář + index (`b4a58b397c6b0cc416bc973f720602a83dc6d0fd`)

## Diskuse
# Fáze 32 — Štíhlý graf: adresář + index

## Záměr
Rozsekat monolitický `.mini/graph.md` (dnes 1 soubor, ~981 řádků, 86 `##` sekcí —
jedna na zdrojový soubor) do:
- `.mini/graph/` — jeden **markdown** soubor na zdrojový soubor (stejná `##`
  sekce / obsah jako dnes, jen samostatně),
- `.mini/graph.json` — **lehký index**: pro každý zdroják cesta + cesta k jeho
  graph souboru + **názvy exportů** (aby Claude poznal, co soubor řeší, a otevřel
  jen ty relevantní).

`mini map` i `regenerateGraph` v `done` zapisují tenhle layout. Prompty čtoucí
graf (`discussPhase`, `sessionContext`) navedou Claude, ať začne indexem
(`graph.json`) a per-file soubory z `.mini/graph/` čte **selektivně**, ne celý
graf najednou.

Analogie fáze 31 (štíhlý `state.json`), ale s jedním zásadním rozdílem — viz níže.

## Klíčová rozhodnutí
- **Obsah indexu `graph.json`: cesta + cesta ke graph souboru + názvy exportů.**
  Samotná cesta Claudovi neřekne, co v souboru je → vybíral by naslepo. Názvy
  exportů jsou levné a dají mu vodítko, co otevřít. (Ne importy — to už je blízko
  duplicitě obsahu a zbytečně nafoukne index.)
  Navrhovaný tvar: `{ version, generatedAt, files: [{ path, graphFile, exports: [names] }] }`.
- **Per-file formát: markdown.** Znovupoužít `renderGraphMarkdown` per soubor,
  zůstává Claude-friendly (Read/Grep bez parsování). JSON zamítnut.
- **Starý `graph.md` smazat — jen nový layout.** Jeden zdroj pravdy, žádná
  duplicita. Graf je regenerovatelný, takže bezpečné.
- **ŽÁDNÝ `mini migrate` netřeba.** Klíčový rozdíl proti fázi 31: `state.json`
  se sekal, protože **roste s historií** (`steps[]` všech fází se kupí).
  `graph.md` je čistá **derivace ze zdrojáků** — neroste s historií, jen s
  velikostí codebase, a `mini map` ho pokaždé přepíše celý. Přechod = `mini map`
  prostě zapíše nový layout a starý `graph.md` odstraní. (Tím padá poznámka z
  fáze 31, že migrate jednou pobere i graph.md.)
- **Layout adresáře: zrcadlit strom zdrojáků** pod `.mini/graph/`
  (`src/claude/ask.ts` → `.mini/graph/src/claude/ask.ts.md`). Bez kolizí jmen,
  index stejně drží mapování cest. `toUnix` už řeší separátory napříč OS.
- **Atomicita přes swap celého adresáře:** stavět do `.mini/graph.tmp/` +
  `graph.json.tmp`, pak atomicky prohodit (smazat starý `.mini/graph/` + rename).
  Full rebuild při každém `map` znamená **žádné osiřelé soubory** (celý adresář
  se nahradí) — není potřeba prune jako u store.ts.
- **Žádný prev-snapshot / undo pro graf.** Na rozdíl od stavu se neverzuje;
  `undo` se grafu netýká.
- **Git: `.mini/graph/` + `.mini/graph.json` trackovat** (jako dnes `graph.md`).
  Žádné `*-prev` k ignorování.

## Pozor na
- **Selektivní čtení musí dávat smysl, jinak je split kontraproduktivní.** Dnes
  Claude přečte celou mapu jedním Readem; per-file split = N Readů, pokud
  potřebuje hodně souborů. Zisk se projeví, jen když si umí vybrat **málo**
  relevantních souborů — proto exporty v indexu (vodítko k výběru) jsou jádro
  hodnoty, ne vedlejšák. Prompty to musí Claudovi jasně říct: index = vstupní
  bod, per-file čti cíleně.
- **`graph.md` nikdo neparsuje** — jen prompty říkají „Read .mini/graph.md".
  Takže konzumenti k úpravě jsou jen `src/prompts/discussPhase.ts` (ř. 37) a
  `src/prompts/sessionContext.ts` (ř. 72). Přeformulovat na `graph.json` +
  selektivní čtení `.mini/graph/`.
- **`buildGraph` API se mění.** Dnes vrací `{ graphFile, fileCount, files }` a
  konstanta `GRAPH_FILE = '.mini/graph.md'`. Nově např. `GRAPH_DIR` +
  `GRAPH_INDEX` a result s cestou indexu. Konzumenti: `map.ts` (loguje
  `GRAPH_FILE`, ř. 7/29/32/37), `done.ts` (`regenerateGraph`, import `GRAPH_FILE`).
- **Testy k přepsání:** `src/graph/buildGraph.test.ts` a `src/commands/map.test.ts`
  dnes asertují na vyrenderovaný markdown jednoho souboru a na cestu `graph.md` —
  přepsat na ověření adresáře (`.mini/graph/.../*.md`) + obsahu `graph.json`
  (index, exporty). `renderGraphMarkdown` (per-file) zůstává, jen se volá na
  jeden soubor; její snapshot/testy podle toho.
- **`hasMappableProject` / detekce projektu** se nemění — týká se jen toho, zda
  vůbec mapovat.
- **`regenerateGraph` v `done` je best-effort** (chyby jen warning, nikdy
  nehází) — tuhle vlastnost zachovat i u nového layoutu.
- **CLI popis příkazu `map`** (`src/cli.ts` ř. 195 zmiňuje `.mini/graph.md`) —
  aktualizovat text.

## Run report
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
