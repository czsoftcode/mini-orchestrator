---
phase: 15
verdict: done
steps:
  - title: "Rozšířit `ExportKind` v `types.ts` o `struct` a `trait`"
    status: done
  - title: "Napsat `mapPhpFile` s regex extraktorem do `src/graph/phpMapper.ts`"
    status: done
  - title: "Napsat `mapRustFile` s regex extraktorem do `src/graph/rustMapper.ts`"
    status: done
  - title: "Upravit `buildGraph.ts` — sbírat `.php` a `.rs` soubory, volat příslušné mappery"
    status: done
  - title: "Zobecnit detekci jazyka a hlášky v `map.ts` a `renderGraphMarkdown`"
    status: done
  - title: "Unit testy pro PHP a Rust mappery (včetně negativních fixtur s komentáři)"
    status: done
---

# Fáze 15 — report z auto session

## Co se povedlo

- `ExportKind` rozšířen o `struct` a `trait` (`src/graph/types.ts`). Renderer
  `renderGraphMarkdown` použije generický fallback `- ${kind} ${name}`, takže
  nové kindy bez další úpravy projdou jako `- struct Foo` / `- trait Bar`.
- Nové soubory `src/graph/phpMapper.ts` a `src/graph/rustMapper.ts` se stejnou
  signaturou jako stávající `mapFile` (vrací `FileGraph`). Oba mappery napřed
  comment/string-strip nahrazením mezerami stejné délky (zachová pozice pro
  brace-counting), pak hledají top-level konstrukty pomocí `depthAt`.
- PHP mapper podporuje top-level `use` (včetně aliasu a group `Foo\{X, Y as Z}`),
  `class` (s veřejnými metodami — privátní/protected přeskočí), `interface`,
  `trait`, a top-level `function` se základní signaturou (typ, `?nullable`,
  default → optional, `...` → rest, return type).
- Rust mapper umí vnořené block-komentáře `/* /* */ */`, raw stringy
  `r#"..."#`/`br"..."`/`cr"..."`, byte/c stringy, char literály vs. lifetimes
  (`'a` vs `'a'`), a extrahuje `pub fn|struct|enum|trait` na top-levelu
  (`pub(crate)` se počítá jako pub, `pub` uvnitř `impl` se vědomě nezachytí).
- `buildGraph.ts` má teď univerzální `collectMappableFiles`, dispatch přes
  `mapByLang`, sjednocený renderer a do `IGNORE_DIRS` přidány `vendor/` a
  `target/`. `isTypeScriptProject` přejmenováno na `hasMappableProject` (TS
  alias zrušen — refaktor v `done.ts`, `map.ts` i `cli.ts`).
- Hlášky v `map.ts`, popis v `cli.ts` a header v `nextPhase.ts` zobecněny na
  "TS/PHP/Rust". Snapshot pro `renderGraphMarkdown` upraven na nový text.
- Unit testy: 16 nových (8 PHP + 8 Rust) plus 4 nové integrační v
  `buildGraph.test.ts`. Negativní fixtury pokrývají falešné záchyty v
  komentářích, stringech, heredocu/nowdocu (PHP) a vnořených block-komentářích,
  raw stringech a lifetimes (Rust). Celkem 493 testů, vše zelené, `tsc --noEmit`
  čistý.

## Ověřeno end-to-end

Spustil jsem `node dist/cli.js map` v dočasném projektu s mixem `.php` a `.rs`:
graf správně rozparsoval PHP třídu s veřejnou metodou, top-level funkci,
namespace `use`, a Rust `pub struct`/`pub trait`/`pub fn` se signaturou
`run(name: &str): u32`. Také jsem spustil `mini map` na samotném mini projektu
(jen TS) — výsledek 65 souborů, jen TS sekce, jak má být.

## Poznámky / kompromisy

- PHP `namespace Foo { ... }` (bloková forma) se ignoruje — `class` uvnitř bloku
  by byla na depth 1, takže by se neextrahovala. Konzervativní rozhodnutí, jak
  jsme se domluvili v diskusi; běžnější `namespace Foo;` (bezbloková) funguje
  bez problémů.
- Rust `pub fn` uvnitř `impl Foo { ... }` se vědomě nezachytí. Pokud by to byl
  problém, dalo by se v budoucnu detekovat `impl` blok a vyzobnout z něj public
  funkce — ale podle phase notes se to teď nechtělo.
- Signaturní parser pro PHP/Rust je úmyslně jednoduchý regex — komplikované
  typy jako `int|string|null`, `(impl Trait + 'a)` nebo destructuring patterny
  v parametrech mohou vyjít s `name: '_'` nebo bez typu. Pro mapu projektu je
  to dostačující; full parser by byl mimo scope této fáze.
