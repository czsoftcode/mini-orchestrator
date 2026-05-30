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

## Diskuse
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

## Run report
---
phase: 51
verdict: done
steps:
  - title: "Stripping + odsazení helpery"
    status: done
  - title: "Extrakce importů"
    status: done
  - title: "Top-level exporty s kotvami"
    status: done
  - title: "Metody tříd + signatury parametrů"
    status: done
  - title: "Napojení do buildGraph.ts"
    status: done
  - title: "Zelená brána"
    status: done
---

# Fáze 51 — report z auto session

## Co se udělalo
- Nový **`src/graph/pythonMapper.ts`** (`mapPythonFile`) ve stejném duchu jako PHP/Rust
  mapper, ale postavený na **odsazení**, ne na `{}`:
  - **Stripping** (`stripPythonCommentsAndStrings`): `#` komentáře, single/double i
    **triple-quoted** stringy (docstringy), prefixy `r/f/b/u`/`rb/br/rf/fr` → náhrada
    mezerami stejné délky se zachováním `\n`. Prefix se uzná jen mimo identifikátor
    (`arb"x"` se nechytne jako `rb"x"`).
  - **Importy**: `import a.b [as x]` i `from mod import a, b as c, *` vč. relativních
    (`.`, `..pkg`), víceřádkových v závorkách a backslash-pokračování. Jen modulové
    (sloupec 0).
  - **Exporty**: top-level `def`/`async def` → `function`+signatura, `class` → `class`
    (+ veřejné metody), UPPER_CASE/anotovaná přiřazení → `const`. Jméno s `_` se přeskočí.
    `line` u dekorovaných míří na první `@decorator`, `endLine` best-effort dle odsazení
    (vč. víceřádkových hlaviček a inline `def f(): ...`).
  - **Metody tříd**: def na základní úrovni odsazení těla, mimo `_`, vnořené def se
    nesbírají; `@staticmethod` → `isStatic`; `self`/`cls` se ze signatury vynechá.
  - **Signatury**: type hinty, defaulty (`optional`), `*args`/`**kwargs` (`rest`),
    oddělovače `/` a `*`, návratový typ `-> T`.
- **`buildGraph.ts`** napojen: `Lang` o `'python'`, case v `mapByLang`, `detectLang` pro
  `.py`/`.pyi`, markery `pyproject.toml`/`setup.py` v `hasMappableProject`, `.venv` a
  `__pycache__` do `IGNORE_DIRS`, aktualizované doc-komentáře.
- **Testy**: nový `pythonMapper.test.ts` (10 testů — docstring/komentář/string nevyrobí
  export, importy všech forem, def/async def/class+metody, konstanty, dekorátor v kotvě,
  víceřádkový endLine); `buildGraph.test.ts` rozšířen o `.py` soubor + ignoraci `.venv`
  a o `hasMappableProject` s `pyproject.toml`.

## Ověření
- `npm run typecheck` čistý.
- `npm test` → **494 testů zelených (38 souborů)**, žádný snapshot se nerozbil (token
  measure snapshoty se nezměnily — dotklo se jen graph kódu, ne promptů).
- Smoke test na reálném úryvku (`@dataclass class Point` + metoda + `def main`) vrátil
  správné kotvy (`line` na dekorátoru), `endLine`, metody se zahozeným `self` i importy.

## Poznámky / co je vědomě mimo rozsah
- **`__all__` se neřeší** (dle diskuze) — export = konvence (top-level, bez `_`).
- Lint skript projekt nemá (žádný eslint config) — brána = typecheck + test.
- Vědomá zjednodušení: tuple-unpack přiřazení (`A, B = ...`) se nemapují jako konstanty;
  importy uvnitř `try/except` (odsazené) se neberou (jen modulová úroveň); stringové
  defaulty/forward-ref anotace jsou po strippingu prázdné (typ může chybět, `optional`
  flag ale zůstává). Vše konzervativní, konzistentní s PHP/Rust mapperem.
