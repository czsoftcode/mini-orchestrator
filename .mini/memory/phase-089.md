# Phase 89 — Verze podle jazyka projektu

**Goal:** V done se verze navyšuje na místě podle jazyka projektu (package.json, Cargo.toml, composer.json, pyproject.toml…); pokud žádná konvence nesedí, použije se/vytvoří soubor VERSION v kořeni a tag/stamp/push verzi čtou odtud.

## Steps
- [done] Modul projectVersion s detekci zdroje
- [done] Zapis verze na miste per format
- [done] Fallback VERSION + auto-create 0.1.0
- [done] Napojit done.ts na novy detektor
- [done] Testy projectVersion a done
- [done] Dokumentace README + CHANGELOG

## Auto-commit
- Phase 89: Verze podle jazyka projektu

## Discussion
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

## Run report
---
phase: 89
verdict: done
steps:
  - title: "Modul projectVersion s detekci zdroje"
    status: done
  - title: "Zapis verze na miste per format"
    status: done
  - title: "Fallback VERSION + auto-create 0.1.0"
    status: done
  - title: "Napojit done.ts na novy detektor"
    status: done
  - title: "Testy projectVersion a done"
    status: done
  - title: "Dokumentace README + CHANGELOG"
    status: done
---

# Phase 89 — report from the auto session

## What was done
Verze se v `done` už nezapisuje natvrdo do `package.json`. Nový modul
`src/projectVersion.ts` (`bumpProjectVersion`) detekuje zdroj verze podle jazyka
projektu a navýší semver **na místě** v prvním nalezeném zdroji podle pevné
priority:

1. `package.json` — `"version"` (textová náhrada)
2. `Cargo.toml` — `version` jen v sekci `[package]` (závislosti se netknou)
3. `pyproject.toml` — `version` v `[project]` nebo `[tool.poetry]`
4. `setup.py` — `version="x.y.z"`
5. `composer.json` — jen když pole `version` už existuje (jinak ho nepřidáváme)
6. `__version__ = "x.y.z"` — hledáno v root `*.py` a o úroveň níž
   (`__init__.py`/`_version.py`/`version.py`)
7. `VERSION` — jazykově neutrální fallback; když neexistuje, vytvoří se s `0.1.0`

`done.ts` (`bumpVersion`) teď volá `bumpProjectVersion`, loguje i zdroj
(`Version: 1.2.0 → 1.3.0 (minor, Cargo.toml)`) a u nově vytvořeného `VERSION`
hlásí `Version: created VERSION at 0.1.0`. `tagVersion`/`stampChangelog`
dostávají verzi z téhož zdroje (návratová hodnota `to`), takže tag i CHANGELOG
stamp sedí. Komentáře, které dřív mluvily o „package.json", upraveny.

## Edge cases ošetřené
- `Cargo.toml` workspace root bez `[package]` → fallback na `VERSION`.
- `pyproject.toml` s `dynamic = ["version"]` (bez literální `version`) → fallback.
- `composer.json` bez `version` → pole se nepřidá, fallback.
- Neplatný obsah `VERSION` → přepíše se na `0.1.0`.
- Vše best-effort: chyba čtení vrací `null` a zkusí se další zdroj; výjimky chytá
  `bumpVersion` v `done.ts` a jen je zaloguje — `done` nespadne.
- Zápis vždy jako jednořádková textová náhrada, žádný JSON/TOML reformat.

## Verification
- Nové testy `src/projectVersion.test.ts` (18 případů): každý zdroj zvlášť,
  priorita package.json > Cargo.toml, auto-create VERSION 0.1.0, bump existující
  VERSION, composer bez version → fallback, pyproject dynamic → fallback, Cargo
  workspace → fallback, `__version__` v `__init__.py`, `[package]` vs
  `[dependencies]`.
- `npm run build` čistý (tsc). Celá sada: **724 testů passed (58 souborů)**,
  včetně původních `done.test.ts` (používají `package.json`, nejvyšší priorita →
  beze změny).

Vše ověřitelné mechanicky (build + testy), žádná položka pro lidské ověření.

## Open questions
Žádné. `readPackageVersion` (verze samotného nástroje) zůstala nedotčená — to je
verze miniho z jeho `package.json`, ne uživatelského projektu.
