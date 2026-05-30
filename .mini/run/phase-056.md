---
phase: 56
verdict: done
steps:
  - title: "Kostra csharpMapperu + stripCSharp"
    status: done
  - title: "Usingy a namespace"
    status: done
  - title: "Typy a členy"
    status: done
  - title: "Zapojení do buildGraph"
    status: done
  - title: "Testy a zelený build"
    status: done
---

# Fáze 56 — report z auto session

## Co se udělalo

- **`src/graph/csharpMapper.ts`** (`mapCSharpFile`) — nový mapper podle vzoru
  `javaMapper.ts`, C# je strukturou nejblíž.
  - **`stripCSharp`** nahradí mezerami stejné délky (se zachováním `\n`, takže
    čísla řádků sedí): komentáře (`//`, `///` XML doc, `/* */`), char literály
    a stringy ve všech variantách — normální `"..."` (s `\` escapy), verbatim
    `@"..."` (kde `""` je escapovaná uvozovka, `\` je literál), interpolované
    `$"..."`/`$@"..."`/`@$"..."` a raw `"""..."""` (C# 11). Prefix `@` před
    ne-uvozovkou se nechá projít (verbatim identifikátor `@class`).
  - **Usingy** → importy: `using X;`, `using A.B.C;` (symbol = poslední segment),
    `using static A.B;`, `global using …;` (přeskočí `global`) a aliasy
    `using Foo = A.B;` (symbol = jméno aliasu). `using (...)`/`using var` v těle
    se ignorují (za klíčovým slovem je `(`).
  - **Namespace** block i file-scoped: braces block-namespace jsou pro sken
    průhledné (eviduji jejich `}` v `nsCloses`), takže typy uvnitř se berou jako
    top-level. Funguje i pro vnořené namespacy.
  - **Typy**: `class`/`struct`/`interface`/`enum`/`record` (vč. `record class`/
    `record struct` → kind podle druhého slova). Kotvy `line`/`endLine`. Atributy
    `[...]` a modifikátory se přeskakují.
  - **Členy**: `public`/`internal` metody jako `methods` se signaturou + `static`
    značka; v interface implicitně public. Vlastnosti (`{ get; set; }`), pole,
    eventy a vnořené typy se přeskočí (model `ExportInfo` pro ně slot nemá, stejně
    jako u Javy/Go). Parametry: `ref/out/in/params/this/scoped`, atributy, default
    hodnoty (`optional`), `params` → `rest`.
- **`src/graph/buildGraph.ts`**: import `mapCSharpFile`, `Lang` o `'csharp'`,
  větev v `mapByLang`, `detectLang` mapuje `.cs`. `hasMappableProject` detekuje
  C# přes `*.sln`/`*.csproj` v kořeni (nová pomocná `hasFileWithExt` — názvy jsou
  variabilní, nejde použít přesný `fileExists`).
- **Uživatelské řetězce**: `commands/map.ts` (hláška o mapovatelných souborech,
  „Mapuji …" log, docstring) a `cli.ts` (popis příkazu `map`) doplněny o
  Python/Go/Java/C# — předchozí fáze je nechaly stát jen na TS/PHP/Rust.

## Ověření

- `npx vitest run src/graph/csharpMapper.test.ts` → 14/14 (usingy, namespace
  block i file-scoped, všechny druhy typů, metody/konstruktor, strip
  komentářů/stringů/verbatim/raw/char, kotvy řádků, default-internal vs.
  file-scoped vs. vnořený typ).
- `npm test` → **536/536** zelené, `npm run build` (tsc) čistý. (Samostatný lint
  skript projekt nemá — typovou kontrolu dělá `tsc`.)
- Smoke test end-to-end: `buildGraph` nad dočasným `.cs` souborem správně vrátí
  typ i metodu (ověřeno, temp uklizen).

## Pozn. / na co dát pozor při review

- **Notace exportu typů vs. členů se liší (záměr, dle C# sémantiky):** top-level
  typ bez access modifieru je v C# `internal`, takže ho bereme jako export
  (vylučujeme jen `file` a `private`). Naproti tomu člen bez modifieru je
  `private` → metoda je export jen při explicitním `public`/`internal` (v
  interface implicitně public). Cíl fáze říkal „public/internal" — default typ
  internal tedy spadá pod „internal".
- **Hrana interpolovaných stringů:** `$"{Foo("x")}"` (uvozovka uvnitř
  interpolačního holu) se stripem rozbije — stejně jako Java mapper interpolaci
  neřeší. V praxi jen v tělech metod, která stejně nepročítáme, takže top-level
  deklarace to neovlivní.
- `.mini/graph` jsem **nepřegeneroval** (projekt sám žádné `.cs` nemá, jen bych
  zbytečně načechral graf). Mapper i zapojení jsou ověřené testy + smoke testem.
