# Fáze 52 — Mapa pro Go

**Cíl:** Přidat goMapper.ts pro extrakci importů a top-level exportů (func, type, const, var, metody s receiverem; exportované podle velkého počátečního písmene) z .go souborů, napojit na detectLang a hasMappableProject (marker go.mod) v buildGraph.ts a ověřit unit testy mapperu i snapshotem grafu.

## Kroky
- [hotovo] Stripping komentářů a stringů + kostra
- [hotovo] Extrakce importů
- [hotovo] Top-level exporty func/type/const/var
- [hotovo] Signatury funkcí + receiver metody
- [hotovo] Napojení do buildGraph.ts
- [hotovo] Testy + zelená brána

## Auto-commit
- Fáze 52: Mapa pro Go (`128b166b9a691dfb6aefde9d96012dc607c555cc`)

## Run report
---
phase: 52
verdict: done
steps:
  - title: "Stripping komentářů a stringů + kostra"
    status: done
  - title: "Extrakce importů"
    status: done
  - title: "Top-level exporty func/type/const/var"
    status: done
  - title: "Signatury funkcí + receiver metody"
    status: done
  - title: "Napojení do buildGraph.ts"
    status: done
  - title: "Testy + zelená brána"
    status: done
---

# Fáze 52 — report z auto session

## Co se udělalo
- Nový `src/graph/goMapper.ts` s exportem `mapGoFile`. Mapuje `.go` soubory:
  importy (single i blokový `import ( … )`, alias / `_` blank / `.` dot), top-level
  exporty `func` / `type` (struct/interface/alias) / `const` / `var` (vč. seskupených
  `const(…)`/`var(…)`), signatury funkcí a metody připojené k receiver typu.
- Napojení v `src/graph/buildGraph.ts`: `Lang` += `'go'`, case v `mapByLang`,
  `detectLang` pro `.go`, `hasMappableProject` marker `go.mod`, aktualizované
  doc-komentáře s příponami.
- `renderExport` v buildGraph zjednodušeno tak, aby metody renderoval pro libovolný
  kind s `methods` (class i Go struct/interface), ne jen `class`. Výstup pro `class`
  zůstává bajt po bajtu stejný → snapshoty nedotčené.
- Testy: `goMapper.test.ts` (importy, sdílený typ + variadic, struct+interface,
  receiver metoda, grouped const/var, ignorace komentářů/stringů/raw stringů, endLine)
  a 3 nové testy v `buildGraph.test.ts` (mapování `.go` + ignorace `vendor/`,
  marker `go.mod`, jen-`.go` projekt).

## Ověření (strojově, vše zelené)
- `npm test` → 39 souborů, 506 testů passed.
- `npm run typecheck` → bez chyb.
- Ruční sanity render Go vzorku potvrdil správné kotvy `@L`, signatury, aliasy
  importů i metody pod structem.

## Klíčová rozhodnutí / na co dát pozor
- **Dvě varianty strippingu.** Importy se tahají z varianty se zachovanými stringy
  (`stripGo(content, false)`), protože cesta balíčku je string literál; exporty z plně
  očištěné varianty (brace-counting, čísla řádků). Komentáře jdou pryč v obou.
- **Jednoprůchodový sken s plnou spotřebou deklarace** (ne regex+depthAt jako Rust/PHP):
  každá deklarace se přeskočí celá vč. těla, takže se vyhneme falešnému `func` uvnitř
  `type H func(…)` a nezanořujeme se do těl.
- **Sdílený typ parametrů** (`a, b int`) řešen „pending names" — jména bez typu zdědí typ
  první následující otypované skupiny; zbytek bez typu = nepojmenované typy (`(int, error)`).
- **Forward decl bez těla** (asm funkce) → `findBodyBrace` vrátí -1, `endLine` se vynechá.
  `findBodyBrace` se zastaví na konci řádku (gofmt dává `{` na řádek s `)`), aby
  neutekl do další deklarace; přeskakuje inline `interface{}`/`struct{…}` v návratovém typu.
- **Exportovanost** = `\p{Lu}` (Unicode velké písmeno) na prvním znaku.

## Otevřené / vědomá zjednodušení
- Interface metody a struct fieldy se neextrahují (jen kind + endLine), metody jen přes
  receiver — odpovídá zadání a konzervativnímu stylu ostatních mapperů.
- Poslední segment cesty importu nemusí být přesný název balíčku (`gopkg.in/yaml.v2`),
  ale jako symbol-hint to stačí.
