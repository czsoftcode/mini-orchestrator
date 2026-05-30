---
phase: 57
verdict: done
steps:
  - title: "Kostra kotlinMapperu + stripKotlin"
    status: done
  - title: "Package a importy (vč. as aliasů)"
    status: done
  - title: "Typy a top-level fun"
    status: done
  - title: "Zapojení do buildGraph"
    status: done
  - title: "Testy a zelený build"
    status: done
---

# Fáze 57 — report z auto session

## Co je hotové

Nový `src/graph/kotlinMapper.ts` s exportem `mapKotlinFile(content, relPath)` zapojený do `buildGraph`.

- **stripKotlin** — nahrazuje komentáře, stringy a char literály mezerami stejné délky se zachováním `\n`. Klíčové oproti Javě/C#: Kotlin **vnořuje** block komentáře (`/* /* */ */`), takže držím hloubku — pokryto testem (`fun fakeInBlock` uvnitř vnořeného bloku se nesmí stát exportem). Raw stringy `"""…"""` i KDoc jsou ošetřené.
- **Importy** — `import a.b.C`, `import a.b.*` (→ `['*']`), aliasy `import a.b.C as D` (→ `['D']`). `package` se nebere (slouží jen jako kontext, FileGraph ho nenese).
- **Typy + top-level fun** — top-level `fun` jako `function` export se signaturou (parametry `name: Type`, default → `optional`, `vararg` → `rest`, návratový typ, generika, extension receiver `fun String.foo()`). Typy `class`/`interface`/`object`/`enum class`/`data class`/`sealed class|interface`/`annotation class`. Default viditelnost `public`; `private`/`internal` se vynechá. Uvnitř typů viditelné metody (`fun`) jako `methods`; vnořené typy, vlastnosti, init bloky a sekundární konstruktory se přeskočí (nezanořuje se).
  - Mapování kindů: `enum class` → `enum`, `interface`/`sealed interface`/`fun interface` → `interface`, ostatní (vč. `object` a `annotation class`) → `class` (model `ExportKind` nemá `object`/`annotation` slot). `fun interface` se korektně rozpozná (`fun` je tu modifier, ne funkce).
- **buildGraph** — přidán `Lang` o `kotlin`, větev v `mapByLang`, `detectLang` na `.kt`/`.kts`, komentář u `hasMappableProject` (gradle `build.gradle.kts` už tam byl, samostatné `.kt`/`.kts` pokryje fallback přes `detectLang`). Doplněny hlášky v `map.ts` a popis příkazu v `cli.ts`.

## Ověřeno

- `src/graph/kotlinMapper.test.ts` — 11 testů (importy vč. star/alias, strip komentářů/stringů vč. vnořeného bloku a raw stringu, top-level fun se signaturou, generika/výrazové tělo/extension, private+internal vynechání, class s metodami, data class bez těla, enum/object/interface/fun interface/sealed/annotation, kotvy řádků, vararg+default).
- `npm test` → **547 passed (42 souborů)**, `npm run build` (tsc) zelený. (Projekt nemá `lint` skript; typecheck je součástí buildu.)
- Smoke test reálného `.kt` souboru přes `mapKotlinFile` dal očekávaný graf (extension/alias import, data class bez těla, private metoda vynechána).

## Poznámky

- Při ladění kotev jsem zjistil, že `declStart` se zachytával na pozici skenu (často `\n` před deklarací) místo na prvním reálném tokenu — opraveno přes `skipWs`. Stejná drobná nepřesnost je latentně i v Java/C# mapperu (jejich testy přesný řádek nekontrolují, tady ano).
- Vědomě konzervativní hranice: top-level `val`/`var` a `typealias` se nemapují jako exporty (mimo zadání fáze), metody `companion object` uvnitř třídy se neberou, víceřádkové výrazové tělo funkce (`= …`) má `endLine` best-effort na prvním řádku. Vše konzistentní s ostatními mappery.
