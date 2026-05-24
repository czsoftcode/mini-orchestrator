# Fáze 15 — mini map pro PHP a Rust

## Co se udělalo

- `src/graph/types.ts`: `ExportKind` union rozšířen o `struct` a `trait`; renderer má generický fallback `- ${kind} ${name}`, takže nové kindy nevyžadují další úpravy.
- `src/graph/phpMapper.ts` (nový): regex mapper vracející `FileGraph`; detekuje top-level `use` (včetně aliasů a group importů `Foo\{X, Y as Z}`), `class` s veřejnými metodami, `interface`, `trait`, top-level `function`; komentáře a stringy se před parsováním nahradí mezerami (zachová pozice) a `depthAt` hlídá hloubku.
- `src/graph/rustMapper.ts` (nový): regex mapper se stejnou signaturou; zvládá vnořené block-komentáře `/* /* */ */`, raw stringy (`r#"..."#`, `br"..."`, `cr"..."`), byte/c stringy, char literály vs. lifetimes; extrahuje `pub fn|struct|enum|trait` na top-levelu, `pub(crate)` se počítá jako pub.
- `src/graph/buildGraph.ts`: přidána `collectMappableFiles` (sbírá TS + PHP + RS v jednom průchodu), dispatch `mapByLang`, do `IGNORE_DIRS` přidány `vendor/` a `target/`; `isTypeScriptProject` přejmenováno na `hasMappableProject` (refaktor propagován do `done.ts`, `map.ts`, `cli.ts`).
- `src/commands/map.ts`, `src/commands/cli.ts`, `src/graph/nextPhase.ts`: hlášky a popis zobecněny z "TS/TSX" na "TS/PHP/Rust".
- Unit testy: 16 nových (8 PHP + 8 Rust), 4 nové integrační v `buildGraph.test.ts`; celkem 493 testů, vše zelené, `tsc --noEmit` čistý.

## Klíčová rozhodnutí

- **Vlastní `struct`/`trait` v `ExportKind`** místo mapování na `class`/`interface` — aliasy by byly sémanticky zavádějící, zvláště pro PHP `trait`.
- **Comment/string strip před regexem** (náhrada mezerami stejné délky) — jednoduchý způsob, jak se vyhnout falešným záchytům v komentářích a heredocu/nowdocu bez nutnosti plnohodnotného lexeru.
- **`depthAt` pro top-level detekci** — počítá složené závorky až po danou pozici; spolehlivé pro PHP a Rust, kde všechny zajímavé top-level konstrukty jsou na depth 0.
- **PHP bloková namespace `namespace Foo { ... }` se ignoruje** — třída uvnitř bloku by byla na depth 1, takže by se nezachytila. Běžnější `namespace Foo;` funguje. Konzervativní záměrný kompromis.
- **Rust `pub fn` uvnitř `impl` bloků se nezachytí** — detekce `impl` kontextu by přidala komplexitu bez jasného přínosu pro mapu projektu; odloženo do případné budoucí fáze.
- **Signaturní parsery jsou záměrně jednoduché** — složité typy (`int|string|null`, `impl Trait + 'a`, destructuring) mohou vyjít s `name: '_'` nebo bez typu; pro přehledovou mapu dostačující, full AST parser mimo scope.

## Otevřené konce

- PHP bloková namespace (`namespace Foo { ... }`) není podporována — pokud by projekt tuto formu používal, třídy uvnitř by se nezachytily.
- Rust `pub fn` v `impl` blocích chybí — pro projekty, kde jsou veřejné asociované funkce v `impl`, graf nebude úplný.
- Signaturní parsery mohou selhávat na exotické syntaxi (generics s lifetimes, PHP union/intersection typy) — výstup bude nepřesný, ale nespadne.
- Přidání dalšího jazyka (např. Python, Go) by vyžadovalo nový mapper + rozšíření `mapByLang` dispatch a `collectMappableFiles` — architektura to umožňuje, ale žádný jazyk zatím není naplánován.
