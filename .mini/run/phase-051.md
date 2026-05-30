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
