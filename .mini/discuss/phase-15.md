# Fáze 15 — mini map pro PHP a Rust

## Záměr

Rozšířit `mini map` o regex-based mappery pro `.php` a `.rs` soubory. Výstup se sloučí do jednoho `.mini/graph.md` spolu s TS sekcí — jeden graf na projekt bez ohledu na to, jestli je mono-language nebo smíšený (např. TS frontend + PHP backend).

Detekce jazyka = přítomnost souborů s příslušnou příponou; žádná explicitní konfigurace. Fallback "není co mapovat" nastane jen pokud projekt nemá ani `.ts`/`.tsx` ani `.php` ani `.rs`.

## Klíčová rozhodnutí

**ExportKind**: Rozšířit union v `types.ts` o `struct` a `trait`. Mapování Rust struct → class nebo PHP trait → interface by bylo matoucí.

**PHP extrakce**:
- imports: top-level `use` příkazy (ne `use` uvnitř metod/funkcí)
- exports: top-level `class`, `interface`, `trait`, globální `function`; public metody tříd (analogicky TS — private se přeskakují)

**Rust extrakce**:
- imports: top-level `use` příkazy
- exports: `pub fn`, `pub struct`, `pub enum`, `pub trait` na top-levelu (ne uvnitř `impl` bloků); `pub(crate)` se počítá jako pub

**Architektura**:
- `mapPhpFile(content, relPath): FileGraph` a `mapRustFile(content, relPath): FileGraph` — stejná signatura jako stávající `mapFile`; umístění v `src/graph/`
- `buildGraph` sbírá všechny tři typy souborů v jednom průchodu, řadí je společně, renderuje jedním `renderGraphMarkdown`
- `renderGraphMarkdown` a `FileGraph` zůstávají beze změny (jen komentář "TS/TSX" v textu grafu se zobecní)
- `map.ts` (CLI command): `isTypeScriptProject` se nahradí obecným detektorem; zpráva uživateli se odpovídajícím způsobem upraví

## Pozor na

- Regex parsery jsou záměrně konzervativní: raději symbol vynechají, než aby ho extrahovaly z komentáře nebo heredocu/víceřádkového stringu
- PHP `use` uvnitř těla metody nebo funkce se nesmí sbírat (jen top-level)
- Rust `impl` bloky se nemapu — jen top-level `pub` deklarace
- Unit testy pro PHP a Rust mappery musí pokrýt falešné záchyty v komentářích (negativní fixture)
- Popis v záhlaví `graph.md` ("TS/TSX souborů") je třeba zobecnit, aby nezaváděl
