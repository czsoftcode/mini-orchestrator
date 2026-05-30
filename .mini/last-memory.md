# Fáze 50 — CHANGELOG.md v /mini:done

**Cíl:** Done session prompt (buildDoneSessionPrompt) dostane instrukci, aby Claude před 'mini done --apply' založil/aktualizoval CHANGELOG.md podle zásad keepachangelog 1.1.0 — sekce '## [verze] - YYYY-MM-DD' s Added/Changed/Fixed poskládanými z reportu hotové fáze — aby ho commit fáze pobral; ověřeno snapshot testem promptu.

## Kroky
- [hotovo] Modul changelog.ts + stamp funkce
- [hotovo] Napojení stampu do commitPhaseWork (done.ts)
- [hotovo] Instrukce o CHANGELOGu do done promptu
- [hotovo] Zelená brána

## Auto-commit
- Fáze 50: CHANGELOG.md v /mini:done (`a10ba26554e91b144b97b56a0dc6b36ca53f6fbe`)

## Pozor na
- **Pořadí v `commitPhaseWork` (done.ts):** stamp CHANGELOGu musí proběhnout
  PŘED `commitAll`, aby zaklapnutá sekce skončila v commitu, který se pushuje.
  Bump verze se děje hned na začátku `commitPhaseWork` — stamp tedy až po bumpu,
  aby znal cílovou verzi (`version` se tam už drží pro tag). Podmínka stampu:
  `finalizeOpts.push && (bump === 'minor' || bump === 'major')`. Pozor: `bump` má
  default `patch` (viz `finalizeOpts.bump ?? 'patch'`), takže defaultní done nestampuje.
- **Claudovy zápisy do Unreleased vznikají v session ještě před `mini done --apply`**
  → jsou v pracovním stromě, `git add -A` v commitu fáze je pobere. Prompt to musí
  jasně načasovat (nejdřív CHANGELOG, pak `mini done --apply ...`).
- **Best-effort, nikdy neblokovat done:** chybějící/nestandardní `CHANGELOG.md`
  nebo chybějící `## [Unreleased]` sekce jen zalogovat warningem, ne házet —
  stejně jako okolní git/version logika v `finalizeOpts`.
- **Idempotence:** když uživatel pushne fázi, kde Unreleased nemá žádné položky,
  nestampovat prázdnou sekci (nevytvářet `[verze]` bez obsahu).
- Stamp logiku dát do samostatného modulu (např. `src/changelog.ts`) s čistou
  funkcí, ať jde otestovat izolovaně (unit testy) bez gitu; prompt ověřit snapshotem.
- Aktualizovat snapshoty `buildDoneSessionPrompt` (existující snapshot testy promptu).

## Pozor / poznámky
- **Trigger stampování = `--push` + `--bump minor`/`major`** (dle upřesnění v diskuzi).
  Default patch neprodukuje datovanou sekci; tahle fáze se tedy při běžném
  `mini done --apply --push` (patch) jen přidá do Unreleased, datovaná sekce vznikne
  až u příštího minor/major vydání.
- Měření tokenů: done prompt povyrostl o CHANGELOG sekci → aktualizoval jsem 2 snapshoty
  v `src/tokens/__snapshots__/measure.test.ts.snap` (čekané, jen čísla).
- Projekt zatím `CHANGELOG.md` nemá — viz verify bod výše.
