# Fáze 59 — Mapa pro Ruby

**Cíl:** Přidat rubyMapper (mapRubyFile) parsující .rb soubory (require/require_relative, top-level metody def, typy class/module, jejich metody a atributy attr_*, respekt k viditelnosti private/protected) a zapojit Ruby do buildGraph (Lang, detectLang na .rb, hasMappableProject přes Gemfile/*.rb) i hlášek v map.ts/cli.ts, včetně testů a zeleného buildu.

## Kroky
- [hotovo] Kostra rubyMapperu + stripRuby
- [hotovo] Importy (require/require_relative)
- [hotovo] Typy a top-level metody
- [hotovo] Zapojení do buildGraph
- [hotovo] Testy a zelený build

## Auto-commit
- Fáze 59: Mapa pro Ruby (`73b8483f5a6e7713e12435c2f5285b047524d881`)

## Run report
---
phase: 59
verdict: done
steps:
  - title: "Kostra rubyMapperu + stripRuby"
    status: done
  - title: "Importy (require/require_relative)"
    status: done
  - title: "Typy a top-level metody"
    status: done
  - title: "Zapojení do buildGraph"
    status: done
  - title: "Testy a zelený build"
    status: done
---

# Fáze 59 — report z auto session

## Co se udělalo
- Nový `src/graph/rubyMapper.ts` s `mapRubyFile(content, relPath)`. Ruby nemá
  závorkové bloky, takže parser jede **po řádcích / `;`-příkazech** a drží
  zásobník rámců (`class`/`module`/`def`/blok) párovaný s `end`.
  - **Stripping ve dvou krocích:** `blankComments` (řádkové `#` i blokové
    `=begin`/`=end`, stringy ponechá kvůli importům) → z toho `extractRubyImports`
    vytáhne `require`/`require_relative` (vč. závorek); pak `blankStrings` obsah
    stringů vynuluje na mezery se zachováním `\n`, aby řádky seděly.
  - **Top-level `def`** → `function` export se signaturou + kotvami (`line`/`endLine`).
    Zvládá splat (`*`/`**` → `rest`), keyword (`key:` / `opt: 5`), default (`optional`),
    `&block`, endless metody (`def x = …`) i víceřádkovou hlavičku.
  - **Typy `class` (kind `class`) a `module` (nový kind `module`)** na top-levelu,
    jejich viditelné instanční/třídní metody (`def self.x` → `isStatic`) a atributy
    (`attr_reader`/`writer`/`accessor` → metody, accessor i `name=`).
  - **Viditelnost:** default `public`; holé `private`/`protected` i `private def …`
    skryjí následující členy. Vnořené typy a jejich členy se nemapují (model nemá
    slot na vnoření) — jen drží `end` párování.
- `types.ts`: do `ExportKind` přidán `'module'` (renderer kind tiskne verbatim,
  žádný exhaustivní `switch` se nerozbil).
- `buildGraph.ts`: `'ruby'` v `Lang`, `case` na `mapRubyFile`, `detectLang` na
  `.rb`, `hasMappableProject` přes `Gemfile` (+ `.rb` přes obecný sběr souborů).
- Hlášky v `commands/map.ts` a `cli.ts` doplněny o Ruby / `.rb`.

## Testy
- Nový `rubyMapper.test.ts` (11 testů): importy se závorkami, ignorování
  komentářů/`=begin`/stringů, signatury vč. splat/keyword/default/block, endless
  metoda, class s metodami + atributy + viditelnost (private/protected/vnořené),
  module jako kind `module`, vnořené typy bez exportu, kotvy na správných řádcích,
  a robustnost vůči `if`/`do…end` uvnitř metod.
- `buildGraph.test.ts`: 2 nové `hasMappableProject` testy (Gemfile, samotný `.rb`).
- `npm run build` zelený, celá sada **573 testů prošlo**.

## Na co dát pozor (vědomá omezení, best-effort)
- Heredocy (`<<~SQL … SQL`) a `%w[]`/`%i[]` literály parser nevyhodnocuje — pokud
  by jejich tělo obsahovalo slovo `end`, mohlo by rozhodit párování. V běžných
  definicích tříd se to nevyskytuje.
- `private :symbol` (skrytí už nadeklarované metody) se neřeší; pokryto je jen
  holé přepínání viditelnosti a `private def …`.
- `define_method` a metaprogramování se nemapuje.
