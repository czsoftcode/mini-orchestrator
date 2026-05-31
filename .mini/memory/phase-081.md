# Fáze 81 — Anglický README + CHANGELOG

**Cíl:** Přeložit README.md a CHANGELOG.md kompletně do angličtiny (zachovat code-bloky, názvy příkazů/flagů, cesty, odkazy a keepachangelog 1.1.0 strukturu vč. nadpisů Added/Changed/Fixed a [Unreleased]) a zakotvit konvenci, že nové zápisky do CHANGELOG.md i projektová dokumentace se píšou anglicky (doplnit do CLAUDE.md a docs/i18n-glossary.md). Ověřit, že v obou souborech nezůstala česká próza a že struktura/odkazy/příklady sedí.

## Kroky
- [hotovo] Přeložit README.md do AJ
- [hotovo] Přeložit CHANGELOG.md do AJ
- [hotovo] Zakotvit konvenci anglických docs
- [hotovo] Ověřit překlad a zelený build

## Auto-commit
- Fáze 81: Anglický README + CHANGELOG

## Run report
---
phase: 81
verdict: done
steps:
  - title: "Přeložit README.md do AJ"
    status: done
  - title: "Přeložit CHANGELOG.md do AJ"
    status: done
  - title: "Zakotvit konvenci anglických docs"
    status: done
  - title: "Ověřit překlad a zelený build"
    status: done
---

# Phase 81 — report from the auto session

## Co se povedlo

Veřejná dokumentace přeložena do angličtiny.

- **`README.md`** — celý soubor anglicky (298 řádků): všechny sekce (Requirements,
  Installation, Quick start, Commands, Models, Machine-readable project map, Files
  in the project, Auto mode, Import from GSD, FAQ, Workflow tips, License).
  Zachovány code-bloky, názvy příkazů/flagů, cesty, odkazy a hierarchie nadpisů.
  **Vnitřní anchor odkazy** přepsány na nové anglické slugy konzistentně s nadpisy
  (`#machine-readable-project-map-graph`, `#autonomous-miniauto`, `#auto-mode`).
  Příklad commit zprávy v FAQ sjednocen na `Phase {id}: {title}`.
- **`CHANGELOG.md`** — celý soubor anglicky (238 řádků): `[Unreleased]` i všechny
  datované verze (1.4.0 → 1.1.0). Zachována keepachangelog 1.1.0 struktura
  (verze+data, `Added`/`Changed`/`Fixed`), názvy příkazů/flagů, cesty a literály
  formátu (`## [Unreleased]`). Úvodní odkaz na semver přepnut z české lokalizace
  (`/lang/cs/`) na `https://semver.org/`. Historická citace `## Nálezy z verify`
  uvedena jako `## Verify findings` (aktuální anglický název sekce).
- **Konvence**: do `CLAUDE.md` (sekce „Jazyk programu") doplněno, že projektová
  dokumentace (`README.md`, `CHANGELOG.md`) i **nové zápisky do `CHANGELOG.md`**
  (záznamy fází přes `/mini:done`) se píšou anglicky. `docs/i18n-glossary.md` —
  „Stav migrace" aktualizován (fáze 79/80/81 doplněny, README+CHANGELOG hotovo).

## Ověření (strojově, vše prošlo)

- Grep diakritiky v `README.md` i `CHANGELOG.md` — **oba čisté** (žádná česká próza).
- Anchor odkazy v README ověřeny proti nadpisům (3 vnitřní odkazy sedí na nové slugy).
- `npm run build` — zelený.
- `npm test` — **652 testů / 50 souborů zelených** (docs nemají vliv, sanity).

## Poznámky / otevřené

- CHANGELOG `[Unreleased]` teď obsahuje i tenhle překlad docs — řádek se přidá při
  `mini done` (CHANGELOG zápisek pro fázi 81). Od teď ho píšu anglicky dle nové
  konvence.
- Zbývá (dle glossary „Stav migrace"): lifecycle příkazy
  (`do`/`done`/`next`/`plan`/`auto`/`discuss`/`context`), `src/state/*`
  (vč. `SCOPE_LABELS`), graph mappery (`src/graph/*`).
