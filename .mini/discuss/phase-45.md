# Fáze 45 — Sdílená instrukce o grafu

## Záměr
Instrukce „jak využít `.mini/graph.json` + `.mini/graph/` při čtení kódu" je dnes
roztroušená, nejednotná a chybí ve většině promptů. Cíl: jeden sdílený kanonický
odstavec, importovaný do všech prompt builderů, aby agent ve **všech** krocích
navigoval kód přes graf (index → per-file mapa → zdroják) místo slepého
Read/Grep.

## Klíčová rozhodnutí
- **Dvě rodiny promptů** (potvrzeno, `sessionContext.ts:6`): interaktivní (pro
  `/mini:*` v Claude Code) a headless (pro `mini next/plan/auto` jako podproces).
  Blok musí jít do OBOU rodin.
- **Rozsah = jen next, discuss, plan** (do/auto VYŘAZENO). Důvod: v do/auto agent
  kód sám mění → graf je zastaralý a může mást; navíc fázi už zná z plánu →
  opakovaný náklad ~5 k tokenů (index `graph.json`) je spíš režie. Graf je výhra
  na *průzkumných* krocích, ne při implementaci.
- **Jeden těsný odstavec** (ne krátká+dlouhá varianta) — jeden exportovaný string,
  kvůli token rozpočtu co nejstručnější (2-3 věty).
- **Umístění**: nový malý modul (např. `src/prompts/graphHint.ts`) exportující
  konstantu (např. `GRAPH_USAGE_HINT`). Žádný fs přístup — builders jsou čisté
  string funkce, „(pokud existuje)" řeší text, ne kód.
- **Obsah bloku = žebříček**: (1) `.mini/graph.json` (index, pokud existuje) →
  (2) cílené per-file mapy `.mini/graph/<cesta>.md` → (3) teprve zdrojáky.
  U **velkých** souborů preferovat výřez (symbol najít přes Grep, přečíst `Read`
  s `offset/limit`), ne celý soubor; **malé** soubory klidně celé. Formulovat jako
  preferenci, NE jako tvrdé „nikdy celé soubory".
- **Hledání = Grep tool (ripgrep)**. V Claude Code je Grep tool postavený na rg,
  takže rychlost je zařízená nástrojem — žádný shellový `grep`/`rg` fallback do
  textu netahat.

## Místa k úpravě (mapování builderů)
| krok | interaktivní (`sessionContext.ts`) | headless |
|------|------------------------------------|----------|
| next | `buildNextSessionPrompt` (nahradit stávající větu o grafu, `:77`) | `nextPhase.ts` (doplnit) |
| plan | `buildPlanSessionPrompt` (nahradit „čti soubory Read/Glob") | `planPhase.ts` (`:25`, doplnit) |
| discuss | `discussPhase.ts` (`:37`, nahradit dlouhý inline text) — sdílené pro obě | |
| ~~do/auto~~ | mimo rozsah — `autoPhase.ts` nesahat | |

## Pozor na
- **Nahrazovat, ne přidávat**: u next (`sessionContext`) a discuss už věta o grafu
  je — vyměnit za sdílený blok, ať nevznikne duplicita.
- **Prompt-specifické věty nechat zvlášť**: discuss má navíc „kromě poznámek nic
  nezapisuj"; plan má „Nezapisuj nic". To do sdíleného bloku NEPATŘÍ.
- **Blok musí znít neutrálně**, ať sedí do next/plan/discuss (ne do/auto).
- **Snapshoty se pohnou**: `nextPhase`, `planPhase`, `discussPhase` + interaktivní
  `sessionContext` (next, plan). `autoPhase` se hnout NESMÍ (mimo rozsah) — pokud
  se hne, něco je špatně. Projít `npm test` a aktualizovat jen očekávané.
- **`.mini/token-report.md`** lze po fázi přegenerovat (`npm run measure-tokens`,
  `measure.ts` čerpá ze `sessionContext`) — volitelné.
- Brána zelená: `npm run typecheck`, `npm test`, `npm run build`.

## Kandidát na příští fázi (mimo 45)
- **Čísla řádků v mapách**: doplnit do `renderFileGraph` / `FileGraph` rozsah
  `start–end` u každého exportu, ať „skoč na funkci" nepotřebuje locate krok přes
  Grep. Bez toho je cílený výřez velkých souborů zatím dvojkrok (najdi + `Read`
  offset/limit). Změna mapperu, ne promptu — samostatná fáze.
