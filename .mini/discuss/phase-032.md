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
