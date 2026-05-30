# Fáze 51 — Mapa pro Python

**Cíl:** Přidat pythonMapper.ts, který z .py souborů vytáhne importy a top-level exporty (funkce, třídy, konstanty s kotvami na řádky), napojit ho na detectLang a shouldMap (marker pyproject.toml/setup.py) v buildGraph.ts a ověřit unit testy mapperu i snapshotem grafu.

## Kroky
- [hotovo] Stripping + odsazení helpery
- [hotovo] Extrakce importů
- [hotovo] Top-level exporty s kotvami
- [hotovo] Metody tříd + signatury parametrů
- [hotovo] Napojení do buildGraph.ts
- [hotovo] Zelená brána

## Auto-commit
- Fáze 51: Mapa pro Python (`34205d079e907b522647f847eac0367d494502fe`)

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
