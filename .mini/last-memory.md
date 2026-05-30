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
