# Fáze 46 — Čísla řádků v mapách grafu

**Cíl:** mini map zapíše ke každému exportu číslo řádku (ExportInfo.line, plněno TS/PHP/Rust mappery, vykresleno v renderFileGraph) a sdílený GRAPH_USAGE_HINT v bodě (3) navede agenta číst přímo od daného řádku přes Read s offset; ověřitelné aktualizovanými snapshoty map + zelená brána.

## Kroky
- [hotovo] ExportInfo.line + endLine v typu
- [hotovo] TS mapper plní line/endLine
- [hotovo] PHP + Rust mapper plní rozsah
- [hotovo] renderFileGraph vykreslí rozsah
- [hotovo] graphHint bod (3) na cílené čtení rozsahu
- [hotovo] Snapshoty + přegenerovat graf + brána

## Auto-commit
- Fáze 46: Čísla řádků v mapách grafu (`032612ac047ad45b8ee68112ddd472f0837194eb`)

## Run report
---
phase: 46
verdict: done
steps:
  - title: "ExportInfo.line + endLine v typu"
    status: done
  - title: "TS mapper plní line/endLine"
    status: done
  - title: "PHP + Rust mapper plní rozsah"
    status: done
  - title: "renderFileGraph vykreslí rozsah"
    status: done
  - title: "graphHint bod (3) na cílené čtení rozsahu"
    status: done
  - title: "Snapshoty + přegenerovat graf + brána"
    status: done
---

# Fáze 46 — report z auto session

## Co se udělalo
- **Typ** (`src/graph/types.ts`): `ExportInfo` má nová nepovinná pole `line?` a
  `endLine?` (1-based, řádek začátku/konce deklarace) s JSDoc.
- **TS mapper** (`src/graph/mapper.ts`): nový helper `lineRange()` přes
  `sourceFile.getLineAndCharacterOfPosition(node.getStart()/getEnd())`; navěšeno
  na všechny exporty (funkce, třídy, interface, type, enum, proměnné,
  re-exporty, default). U `variable` se rozsah počítá z `decl` (přesnější u
  více deklarací na jednom statementu). Přesné pro všechny druhy.
- **PHP mapper** (`src/graph/phpMapper.ts`): helper `lineAt()` (start z `m.index`)
  + `bracedEnd()` (konec přes existující `findOpenBrace`/`matchBrace`). Class má
  rozsah z těla, interface/trait/function best-effort přes tělo `{…}`.
- **Rust mapper** (`src/graph/rustMapper.ts`): `lineAt()` + nový `matchBrace()`
  + `itemEnd()` — scan k prvnímu `{` (tělo → `matchBrace`) nebo `;` (unit/tuple
  struct). fn/struct/enum/trait dostanou konec; co nejde určit, zůstane jen start.
- **Render** (`renderFileGraph` v `buildGraph.ts`): nový `lineSuffix()` přidá za
  bullet exportu ` @L<start>-<end>` (víceřádkové) nebo ` @L<start>` (jednořádkové
  / bez konce). Chybí-li `line`, nepřidá nic.
- **graphHint** (`src/prompts/graphHint.ts`): přepsaný `GRAPH_USAGE_HINT` —
  (1) index načíst jednou a sdílet napříč kroky (nenačítat opakovaně),
  (2) zmínka o kotvě `@L<start>-<end>` u exportů,
  (3) číst kód cíleně přes `Read` od kotvy (`offset` = start, `limit` = end−start+1),
  Grep až když kotva chybí.

## Ověření
- Nové testy řádkových rozsahů: `mapper.test.ts` (Greeter 8–10, VERSION 19, add
  22–24), `phpMapper.test.ts` (class 12–31, interface 33–36, fn 43–46),
  `rustMapper.test.ts` (struct 10–13, trait 20–22, fn 24–27). Čísla jsem
  nejdřív odhadl ručně špatně, pak ověřil programaticky z fixtures a opravil.
- Snapshot renderu rozšířen o exporty s `line`/`endLine`, aktualizován.
- Prompt snapshoty (next/plan/discuss) + token-report (`measure.test.ts`)
  aktualizovány. **`autoPhase` ani `sessionContext` snapshoty se nehnuly** —
  potvrzuje, že hint zůstal mimo do/auto dle záměru.
- Brána zelená: `npm run typecheck`, `npm test` (463/463), `npm run build`.
- `.mini/graph/` přegenerován novým buildem (`node dist/cli.js map`, 90 souborů)
  — mapy teď nesou kotvy, např. `const GRAPH_USAGE_HINT @L11-20`,
  `const GRAPH_DIR @L10`.

## Poznámky
- Metody tříd (`MethodSignature`) zatím kotvu nemají — záměrně mimo rozsah, kotvu
  drží jen top-level export (třída jako celek). Případné doplnění je samostatný
  krok.
- PHP/Rust konec je best-effort; u běžných tvarů (tělo `{…}`, unit/tuple struct)
  funguje, exotické případy spadnou na „jen start", což render i hint zvládají.
