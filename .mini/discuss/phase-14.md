# Fáze 14 — Mapování projektu do grafu znalostí

## Záměr
Dát Claudovi v session `next` kompaktní *mapu projektu* (graf modulů, exportů,
importů, signatur) místo aby si během vlastní úvahy načítal celé soubory přes
`Read`. Cíl je menší token spotřeba **uvnitř** Claude session — prompt z mini
už dnes soubory neinjektuje, problém je, že Claude soubory čte sám.

Mapa je **doplněk** k existujícímu `.mini/codebase.md`:
- `codebase.md` = textový přehled pro člověka (a vedlejší kontext pro Clauda)
- nový graf = strojová mapa orientovaná na exporty/importy/signatury

## Klíčová rozhodnutí

### Scope
- **Vlastní TS-only mapper** (čistě v Node, žádné nové runtime dependence —
  použít `ts-morph` nebo `typescript` Compiler API; preferovat to, co je
  lehčí).
- **Fallback na `graphify`** pro projekty bez `package.json`/`tsconfig.json`.
- **Mixed projekty** (TS + jiný jazyk) → grafit jen TS soubory, zbytek
  ignorovat. Žádný merge s graphify v této fázi.
- **Když není graphify** a projekt není TS → tiše přeskočit, mini funguje dál,
  v `next` promptu prostě nebude blok s grafem.
- Rust / PHP / další vlastní mappery → samostatné fáze v budoucnu.

### Obsah mapy (minimalistický, ale hodnotný)
Pro každý TS/TSX soubor (mimo `node_modules`, `dist`, `.mini`, `.git`,
build artefakty):
- **exporty**: název + kind (`function` / `class` / `type` / `const` / `interface` /
  `enum`)
- **signatury exportovaných funkcí a metod tříd**: pouze parametry a návratový
  typ (žádná těla, žádné JSDoc)
- **importy**: cíl (relativní cesta nebo balíček) + importované symboly

Nezahrnovat (pro tuhle fázi):
- call graph (kdo koho volá) — vyžaduje typový resolver, příliš drahé
- soukromé/neexportované symboly
- těla funkcí, komentáře

### Formát souboru
- `.mini/graph.md` (markdown, ne JSON) — Claude ho čte přes `Read` stejně jako
  `codebase.md`. Kompaktní struktura, jeden soubor = jedna sekce.
- Alternativně se může vrstvit i `.mini/graph.json` jako cache; rozhodnutí
  patří do fáze `plan` podle toho, kolik znovuvyužití bude.

### Životní cyklus
- **Regenerace po každé hotové fázi** (`mini done`), zařadit jako další side
  effect vedle auto-commitu a memory záznamu (`finalizePhaseSideEffects` v
  `done.ts`).
- **Inkrementálně**: zmapovat jen soubory změněné od posledního grafu (porovnání
  podle mtime nebo SHA256 cache; vlastní TS mapper je tak rychlý, že full
  rebuild celého TS projektu mini-velikosti bude pravděpodobně < 1s, takže
  inkrement nemusí být nutná optimalizace na startu — vyhodnotit v `plan`).
- **Manuální regenerace**: doplnit i příkaz (např. `mini map`) jako u
  `mini audit`, ad hoc.
- **Memory scope pro graph?** Pro vlastní TS mapper není potřeba (žádné LLM
  volání). Pro graphify fallback ano — používat existující default scope, ne
  nový.

### Použití v promptech
- **Jen v `next`** — `buildNextPhasePrompt` přidá blok s obsahem
  `.mini/graph.md` (nebo path k němu), pokud soubor existuje.
- `plan` a `do` zůstávají beze změny pro tuhle fázi.

## Pozor na

- **Nemnožit zdroje pravdy**. `codebase.md` (textový), `graph.md` (strojový) a
  hlavní `src/` se nesmí rozejít. Graf je vždy regenerován ze zdrojáků; člověk
  ho needituje. Naopak `codebase.md` může mít ruční poznámky a `mini audit`
  je zachovává.
- **Token rozpočet samotného grafu**. Pokud `.mini/graph.md` naroste nad ~10k
  tokenů (velké projekty), injektovat ho do `next` přestane dávat smysl.
  V `plan`/`do` fázi zvážit: limit velikosti grafu, případně sekce-on-demand
  (Claude si přečte jen relevantní část přes `Read` s offset/limit).
- **TS Compiler API vs ts-morph**. ts-morph je pohodlnější (high-level), ale
  přidá runtime dependence ~5MB. Compiler API je už `typescript` peer (mini
  ho ovšem dnes nemá). Rozhodnout v `plan` na základě dependence audit.
- **graphify integrace**: graphify se spouští jako Claude Code skill
  (`/graphify`), ne jako čistá CLI binárka, která vyplivne JSON. Ověřit v
  `plan`, jaká je opravdu volatelná CLI surface (`graphify ...`?) a jestli to
  jde použít neinteraktivně. Pokud ne, fallback bude jen *hint* uživateli, ať
  si pustí `/graphify` ručně.
- **State.json změny**: zatím není potřeba nic nového. Kdyby se přidávala cache
  per-soubor (SHA), drž ji mimo `state.json` (např. `.mini/graph.cache.json`),
  aby `state.json` zůstal lehký a udržitelný v gitu.
- **Tests**: snapshot test pro `buildNextPhasePrompt` se grafem i bez,
  unit testy pro TS mapper (parse fixture soubor → očekávaná struktura
  exportů/importů/signatur).
- **Detekce TS projektu**: existence `tsconfig.json` nebo `package.json`
  s alespoň jedním `.ts`/`.tsx` souborem v projektu. Edge case: `package.json`
  pro Node bez TS — pak vlastní mapper nemá co dělat, fallback graphify hint.
