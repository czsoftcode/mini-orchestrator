# Changelog

Všechny podstatné změny v tomto projektu jsou zaznamenány zde. Formát vychází
z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) a projekt používá
[sémantické verzování](https://semver.org/lang/cs/).

## [Unreleased]

### Added

- Mapa znalostního grafu nově podporuje **Swift** (`.swift`): vytáhnou se
  importy (vč. submodulů `import Foo.Bar` a kindových `import struct Foo.Bar`)
  a top-level deklarace — `func` (se signaturou parametrů, default hodnot,
  variadik `Int...`, generik, `async`/`throws` i `where` klauzule) a typy
  `class`/`struct`/`enum`/`protocol`/`extension`/`actor`. Default viditelnost je
  `internal`; `private`/`fileprivate` se vynechá (`private(set)` zůstává
  viditelné). Viditelné metody se připojí k typu s kotvami na řádky,
  `static`/`class func` jsou označené. Komentáře (vč. **vnořených** block
  komentářů), doc komentáře i stringy (vč. víceřádkových `"""…"""` a raw
  `#"…"#`) se korektně ignorují. Projekt se rozpozná i podle `Package.swift`.
- Mapa znalostního grafu nově podporuje **Kotlin** (`.kt`/`.kts`): vytáhnou se
  importy (vč. wildcard `import a.b.*` a aliasů `import a.b.C as D`) a top-level
  deklarace — `fun` (se signaturou parametrů, default hodnot, `vararg`, generik
  i extension receiveru) a typy `class`/`interface`/`object`/`enum class`/
  `data class`/`sealed class|interface`/`annotation class`. Default viditelnost
  je `public`; `private`/`internal` se vynechá. Viditelné metody se připojí
  k typu s kotvami na řádky. Komentáře (vč. **vnořených** block komentářů), KDoc,
  char literály i stringy (vč. raw `"""…"""`) se korektně ignorují. Projekt se
  rozpozná i podle `build.gradle.kts`.
- Mapa znalostního grafu nově podporuje **C#** (`.cs`): vytáhnou se usingy
  (`using`, `using static`, `global using` i aliasy `using Foo = A.B`) a top-level
  typy uvnitř `namespace` (block i file-scoped) — `class`/`struct`/`interface`/
  `enum`/`record` (vč. `record class`/`record struct`), s `public`/`internal`
  metodami (signatury parametrů vč. `params`, default hodnot a `static`)
  připojenými k typu a kotvami na řádky. Komentáře, XML doc, char literály
  i stringy ve všech variantách (verbatim `@"…"`, interpolované `$"…"`, raw
  `"""…"""`) se korektně ignorují. Projekt se rozpozná i podle `*.sln`/`*.csproj`.
- `mini done`/`mini auto`: volba `--bump none` — uzavře fázi bez navýšení verze
  (vhodné pro dílčí fáze, kde se verze zvedne až na konci celku).
- Mapa znalostního grafu nově podporuje **Javu** (`.java`): z tříd se vytáhnou
  importy (`import`, `import static` i wildcard `import a.b.*`) a top-level typy —
  `class`/`interface`/`enum`/`record`/`@interface` deklarované jako `public`/`protected`,
  s `public`/`protected` metodami (vč. signatur parametrů, varargs a `static`)
  připojenými k typu a kotvami na řádky. Komentáře, javadoc, stringy i text bloky
  (`"""…"""`) se korektně ignorují. Projekt se rozpozná i podle `pom.xml` nebo
  `build.gradle`(`.kts`).
- Mapa znalostního grafu nově podporuje **Go** (`.go`): z balíčku se vytáhnou
  importy (single i blokový `import ( … )` vč. aliasů, `_` blank a `.` dot importů)
  a top-level exporty — funkce se signaturou, `struct`/`interface`, typové aliasy
  a `const`/`var` (i seskupené), exportované podle velkého počátečního písmene.
  Metody se připojují k receiver typu, vše s kotvami na řádky. Projekt se rozpozná
  i podle `go.mod`.

### Changed

- **Výchozí chování `--bump` je nově `none`** (dřív `patch`): `mini done` ani
  `mini auto` už verzi v `package.json` ve výchozím stavu nenavyšují. Pro
  povýšení použij `--bump patch|minor|major`.
- `--push` nově vyžaduje explicitní `--bump patch|minor|major` — push bez úrovně
  verze (nebo s `none`) skončí chybou. Push = vydání, proto musí mít verzi pro tag.

## [1.2.0] - 2026-05-30

### Added

- Mapa znalostního grafu nově podporuje **Python** (`.py`/`.pyi`): z modulu se
  vytáhnou importy (`import`, `from ... import` vč. relativních, aliasů, `*` a
  víceřádkových) a top-level exporty — funkce (`def`/`async def`) se signaturou,
  třídy s veřejnými metodami a UPPER_CASE/anotované konstanty, s kotvami na řádky.
  Projekt se rozpozná i podle `pyproject.toml`/`setup.py`; `.venv/` a
  `__pycache__/` se ignorují.

## [1.1.0] - 2026-05-30

### Added

- `/mini:done` nově vytváří a udržuje `CHANGELOG.md` ve formátu Keep a Changelog
  1.1.0: Claude z reportu hotové fáze zapisuje změny pod `## [Unreleased]`
  (sekce `Added` / `Changed` / `Fixed`). Při vydání s `--bump minor`/`major`
  a `--push` se obsah `## [Unreleased]` zaklapne do datované sekce
  `## [verze] - datum` (shodné s git tagem) a nahoru se vloží nová prázdná
  `## [Unreleased]`; patche se kumulují v `Unreleased` až do dalšího vydání.
