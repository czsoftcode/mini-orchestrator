# Fáze 51 — Mapa pro Python

## Záměr
Přidat `src/graph/pythonMapper.ts` (`mapPythonFile(content, relPath): FileGraph`) ve
stejném duchu jako `rustMapper.ts`/`phpMapper.ts`: vyčistit komentáře+stringy → vytáhnout
importy a top-level exporty s kotvami na řádky (`line`/`endLine`) → vrátit `FileGraph`.
Napojit na `buildGraph.ts` a pokrýt testy.

## Klíčová rozhodnutí
- **Co je "export" = konvence, ne `__all__`.** Export = top-level symbol na **sloupci 0**
  (žádné odsazení), jehož jméno **nezačíná `_`**. `__all__` se ve v1 NEŘEŠÍ (přidává kód a
  edge-casy — dynamické `__all__` regex nepřečte; navíc většina modulů ho nemá). Konzistentní
  s PHP (`public`) / Rust (`pub`). Poznámka pro budoucno: případně honorovat `__all__`, jen
  když je to statický list literál.
- **Třídy: sbírat veřejné metody** (parita s PHP `extractPhpMethods`). U top-level `class`
  vytáhnout `def` na **jedné úrovni odsazení** uvnitř těla třídy, mimo `_`-prefix →
  `ExportInfo.methods` (`MethodSignature`). Statické/normální metody; `self`/`cls` první
  parametr vynechat ze signatury.
- **Konstanty = jen UPPER_CASE nebo s typovou anotací.** Modulové přiřazení mapovat jako
  `kind: 'const'` jen když je jméno VELKÝMI (`NAME`, `MAX_SIZE`) NEBO má anotaci
  (`cfg: Config = ...`). Běžné lowercase přiřazení bez anotace ignorovat (nezahlcovat mapu).
- **Kotvy:** `line` = řádek deklarace; u `def`/`class` s **dekorátory** anchor na **první
  `@decorator`** (ať `Read` od kotvy pobere i dekorátory). `endLine` = best-effort podle
  **odsazení** — poslední řádek bloku před dalším neprázdným/nekomentářovým řádkem na stejné
  nebo menší úrovni odsazení.
- **ExportKind:** `def` → `function` (+ `signature`), `async def` → taky `function`,
  `class` → `class` (+ `methods`), konstanta → `const`.

## Pozor na
- **Žádné `{}` — Python je odsazením.** Brace-counting z Rust/PHP (`depthAt`, `matchBrace`,
  `itemEnd`) NEPOUŽITELNÝ. Top-level = sloupec 0; `endLine` a hranice těla třídy řešit přes
  úroveň odsazení. Tohle je hlavní nová logika fáze.
- **Stripping stringů je kritický** kvůli docstringům: nutné **triple-quoted** `"""..."""`
  a `'''...'''` (víceřádkové) + prefixy `r`/`f`/`b`/`rb`/`fr` apod. Náhrada **mezerami stejné
  délky** se zachováním `\n` (jako Rust `stripRustCommentsAndStrings`), ať sedí řádky/pozice.
  Jinak docstring obsahující `def`/`class`/`#` vyrobí false-positives. `#` = řádkový komentář
  (Python nemá block komentáře).
- **Importy — dvě formy:** `import a.b.c [as x]` (source = modul, symbol = alias nebo poslední
  segment) a `from mod import a, b as c [, *]` (source = `mod` i relativní `.`/`..mod`,
  symboly = jména/aliasy, `*` → `['*']`). Pozor na **víceřádkové importy v závorkách**
  `from x import (\n a,\n b,\n)` a backslash-pokračování.
- **Signatury parametrů:** type hinty, defaulty, `*args`/`**kwargs` (→ `Parameter.rest`),
  poziční/keyword-only oddělovače `/` a `*`, return `-> T`. Lze parsovat obdobně jako Rust
  `parseRustFnAfterName` (splitTopLevelCommas), ale pozor na `:` v anotacích a `=` defaultech.
- **Napojení v `buildGraph.ts` (3+1 místa):** rozšířit `type Lang` o `'python'`, přidat case
  do `mapByLang` (import `mapPythonFile`), `detectLang` pro `.py` (zvážit `.pyi`),
  `hasMappableProject` marker `pyproject.toml` + `setup.py`, a aktualizovat doc-komentáře
  zmiňující `(.ts/.tsx/.php/.rs)`.
- **Testy:** unit test `pythonMapper.test.ts` s FIXTURE (importy, def/async def, class+metody,
  UPPER konstanta, `_`-private skip, docstring s falešným `def`); rozšířit `buildGraph.test.ts`
  o `.py` soubor + ignoraci (např. `.venv/`); zkontrolovat snapshoty (`__snapshots__`,
  případně token measure snapshoty pokud se dotknou).
