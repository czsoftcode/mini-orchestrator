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
