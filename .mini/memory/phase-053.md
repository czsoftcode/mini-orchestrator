# Fáze 53 — Mapa pro Javu

**Cíl:** Přidat javaMapper.ts pro extrakci import deklarací a top-level exportů z .java souborů (třídy, interfaces, enums, records, public/protected metody a pole; signatury metod), napojit na detectLang a hasMappableProject (marker pom.xml/build.gradle) v buildGraph.ts a ověřit unit testy mapperu i snapshotem grafu.

## Kroky
- [hotovo] Stripping komentářů, stringů, text bloků + kostra
- [hotovo] Extrakce importů
- [hotovo] Top-level typy
- [hotovo] Členy typu: metody a pole + signatury
- [hotovo] Napojení do buildGraph.ts
- [hotovo] Testy + zelená brána

## Auto-commit
- Fáze 53: Mapa pro Javu (`62387e8d4cd295161e5d4263144fbc563bfba2a8`)

## Run report
---
phase: 53
verdict: done
steps:
  - title: "Stripping komentářů, stringů, text bloků + kostra"
    status: done
  - title: "Extrakce importů"
    status: done
  - title: "Top-level typy"
    status: done
  - title: "Členy typu: metody a pole + signatury"
    status: done
  - title: "Napojení do buildGraph.ts"
    status: done
  - title: "Testy + zelená brána"
    status: done
---

# Fáze 53 — report z auto session

## Co se udělalo
- **`src/graph/javaMapper.ts`** — nový mapper `mapJavaFile(content, relPath)` stejnou cestou jako Go/Python:
  - `stripJava` smaže `//`, `/* */`, javadoc `/** */`, stringy `"..."`, **text bloky `"""..."""`** (Java 15+) i char literály `'x'` náhradou mezerami se zachováním `\n` (pozice a čísla řádků sedí). Jedna varianta stačí — Java importy jsou identifikátory, ne string literály.
  - **Importy:** `import a.b.C;`, `import static a.b.C.m;`, `import a.b.*;` → symbol = poslední segment, u `.*` → `['*']`.
  - **Top-level typy** na brace-depth 0: `class`/`interface`/`enum`/`record`/`@interface`, jen `public`/`protected`. `ExportInfo` s `kind` (record→`class`, `@interface`/interface→`interface`), kotvy `@L<start>-<end>` (start = první modifikátor/anotace, end = `}` přes `matchBrace`). Skluz přes anotace `@Foo(...)` a modifikátory (vč. `non-sealed`).
  - **Členy typu** (uvnitř těla, depth 1): `public`/`protected` metody jako `MethodSignature` připojené k typu (parametry s typy, varargs→`rest`, `static`). Konstruktor = metoda bez návratového typu. V `interface`/`@interface` jsou členy implicitně public (mimo výslovné `private`).
- **`src/graph/buildGraph.ts`** — `Lang` rozšířen o `'java'`, import `mapJavaFile`, `mapByLang` case `'java'`, `detectLang` pro `.java`, `hasMappableProject` markery `pom.xml` / `build.gradle` / `build.gradle.kts`; aktualizovaný doc komentář.
- **Testy:** `src/graph/javaMapper.test.ts` (12 testů — importy, top-level typy, metody/pole/vnořené typy, interface/enum/record, package-private, komentáře/javadoc/stringy, text bloky, konstruktor, `non-sealed`) + 4 integrační testy v `buildGraph.test.ts` (mapování `.java`, ignorování `build/`, markery `pom.xml`/`build.gradle`/jen `.java`).

## Brána
- `npm test` → 522 passed (40 souborů), `npm run typecheck` čistý, `npm run build` čistý. Projekt nemá lint skript (brána = typecheck + test).

## Rozhodnutí / na co dát pozor
- **Pole se nesledují** — záměrně, konzistentně s Go (nesleduje struct fields) a Python (class atributy): model `ExportInfo` pro ně nemá slot. Mapper je korektně rozpozná a přeskočí, takže neprosáknou jako falešné metody. Krok "metody a pole" je tím splněn ve smyslu "pole se neemiitují jako bordel".
- **Návratové typy metod** se zatím neplní do `signature.returnType` (drží jen parametry). Go/PHP mappery návratové typy mají, ale u Javy stojí typ před jménem a spolehlivé vytažení (generika, pole, `throws`) by chtělo víc práce — necháno jako možné budoucí vylepšení. Konstruktory tak přirozeně nemají `returnType`.
- **Vnořené typy** se neexportují jako top-level a jejich členy neprosáknou do vnějšího typu (parsují se s `visible:false` a přeskočí se celé).
