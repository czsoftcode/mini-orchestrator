# Phase 89 — Verze podle jazyka projektu

## Intent
Dnes `done` umí navýšit verzi jen v `package.json` (`bumpPackageVersion`,
`done.ts` -> `bumpVersion`); pro ostatní jazyky vrací `null` a tag/stamp/push se
ticho přeskočí. Cíl: detekovat jazyk/manifest projektu a navýšit semver **na
místě podle konvence daného jazyka**. Když žádný známý manifest nesedí, použít
(a v případě potřeby vytvořit) fallback soubor `VERSION` v kořeni — tag a
changelog-stamp pak čtou verzi z téhož zdroje, ze kterého se bumpovalo.

## Key decisions
- **Podporované zdroje verze (v pořadí priority, vyber PRVNÍ nalezený):**
  1. `package.json` — `"version": "x.y.z"` (stávající chování, textová náhrada)
  2. `Cargo.toml` — `version = "x.y.z"` v sekci `[package]`
  3. `pyproject.toml` — `version = "x.y.z"` v `[project]` nebo `[tool.poetry]`
  4. `setup.py` — `version="x.y.z"` ve volání `setup(...)`
  5. `composer.json` — `"version": "x.y.z"` (volitelné pole; když chybí, nevytvářet)
  6. `__version__` v kódu — `__version__ = "x.y.z"` (Python last-resort, hledat
     v běžných místech: `<pkg>/__init__.py`, `_version.py`, `version.py`)
  7. fallback `VERSION` v kořeni
- **Fallback `VERSION`:** holý jednořádkový semver `x.y.z`. Když neexistuje a
  žádný manifest nesedí, **vytvoří se** s **počáteční verzí `0.1.0`** (počáteční
  bump úroveň se ignoruje — 0.1.0 je startovní hodnota). Při dalších `done` se
  čte a navyšuje normálně podle `--bump`.
- **Více manifestů zároveň:** pevná priorita výše, navýší se **jen první**
  nalezený zdroj; tag/stamp čtou ze stejného zdroje.
- **Návratová hodnota beze změny:** bump vrací `{ from, to }` (resp. `to` pro
  tag) — `tagVersion`/`stampChangelog` zůstávají, jen dostávají verzi z nového
  detektoru. `null` (přeskoč) jen když opravdu není kam zapsat (a fallback se
  nemá tvořit).
- **Vlastní verze nástroje (`readPackageVersion`) se NEMĚNÍ** — to je verze
  miniho z jeho vlastního `package.json`, ne uživatelského projektu.

## Watch out for
- Zachovat dnešní styl zápisu: **textová náhrada jen hodnoty verze**, žádný
  `JSON.parse`/`stringify` ani TOML přeformátování — diff musí být jednořádkový.
- `Cargo.toml` může mít `version` i v `[dependencies]`/`[workspace]` — měnit jen
  v sekci `[package]` (workspace root bez `[package]` → přeskočit / fallback).
- `pyproject.toml`: dynamická verze (`dynamic = ["version"]`) → tam pole
  `version` není; nevytvářet ho, spadnout na další zdroj/fallback.
- `__version__` je nejistý — hledat cíleně a best-effort; když není jednoznačné,
  raději přeskočit na `VERSION`. Nezapisovat naslepo do více souborů.
- `composer.json` často `version` nemá schválně (řeší se tagy) — když pole
  chybí, **nepřidávat** ho, jít na fallback.
- Vše best-effort: chyba čtení/zápisu se jen zaloguje, `done` nesmí spadnout.
- Pokrýt testy: každý zdroj zvlášť + priorita + auto-create VERSION 0.1.0 +
  prázdné/chybějící pole.
