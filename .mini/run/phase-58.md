---
phase: 58
verdict: done
steps:
  - title: "Kostra swiftMapperu + stripSwift"
    status: done
  - title: "Importy"
    status: done
  - title: "Typy a top-level func"
    status: done
  - title: "Zapojení do buildGraph"
    status: done
  - title: "Testy a zelený build"
    status: done
---

# Fáze 58 — report z auto session

Přidán `src/graph/swiftMapper.ts` (`mapSwiftFile`) a `swiftMapper.test.ts`, zapojení do `buildGraph` a hlášek hotové. Build (`tsc`) i celá sada (`vitest run`, 43 souborů / 560 testů) zelené. Ověřeno i end-to-end smoke testem `buildGraph` nad `.swift` souborem.

## Co se udělalo

- **stripSwift** — mažu komentáře (`//`, vnořitelné `/* */`), stringy (`"..."`), víceřádkové (`"""..."""`) i raw stringy (`#"..."#`, `##"..."##`, vč. raw víceřádkových `#"""..."""#`) na mezery, se zachováním `\n` kvůli číslům řádků.
- **Importy** — `import Foo`, `import Foo.Bar.Baz` i kindové `import struct Foo.Bar` (kind se přeskočí); `source` = celá tečkami oddělená cesta, `symbols` = poslední segment.
- **Typy a top-level func** — typy `class`/`struct`/`enum`/`protocol`/`extension`/`actor` na brace-depth 0, top-level `func` jako `function` export se signaturou; viditelné metody v těle; `@L` kotvy. Mapování kindů: `struct`→struct, `enum`→enum, `protocol`→interface, `class`/`actor`/`extension`→class (u `extension` je jméno rozšiřovaný typ). `static`/`class func` → metoda s `isStatic`. Generika, `async`/`throws`, `where` klauzule i func bez těla (požadavek protokolu) zvládnuto.
- **Viditelnost** — default Swiftu je `internal`, takže export je vše kromě `private`/`fileprivate`. `private(set)` (omezuje jen setter) zůstává viditelné.
- **Zapojení** — `Lang` rozšířen o `'swift'`, `detectLang` na `.swift`, větev v `mapByLang`, `hasMappableProject` přes `Package.swift`/`*.swift`; hlášky v `map.ts`/`cli.ts` doplněné o Swift.

## Poznámky

- Bug zachycený při psaní testů: `import struct Combine.Just` se v top-level skenu bral jako deklarace `struct` (kindové klíčové slovo) a spolkl následující kód. Vyřešeno přeskočením `import` řádků v `extractSwiftExports`.
- **Vlastnosti** (`var`/`let`), `init`/`deinit`/`subscript` a enum `case` se nemapují — model `ExportInfo`/`MethodSignature` pro ně slot nemá (stejně jako u Kotlinu). Cíl fáze je sice zmiňoval, ale do existujícího modelu se nevejdou; mapují se jen metody (`func`). Případné rozšíření modelu o vlastnosti by bylo na samostatnou fázi napříč všemi mappery.
- Operátorové funkce (`func +(...)`) a `typealias` se vědomě nemapují (konzervativní mapper).
