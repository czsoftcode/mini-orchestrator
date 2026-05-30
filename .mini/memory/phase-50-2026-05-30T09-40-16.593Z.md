# Fáze 50 — CHANGELOG.md v /mini:done

**Cíl:** Done session prompt (buildDoneSessionPrompt) dostane instrukci, aby Claude před 'mini done --apply' založil/aktualizoval CHANGELOG.md podle zásad keepachangelog 1.1.0 — sekce '## [verze] - YYYY-MM-DD' s Added/Changed/Fixed poskládanými z reportu hotové fáze — aby ho commit fáze pobral; ověřeno snapshot testem promptu.

## Kroky
- [hotovo] Modul changelog.ts + stamp funkce
- [hotovo] Napojení stampu do commitPhaseWork (done.ts)
- [hotovo] Instrukce o CHANGELOGu do done promptu
- [hotovo] Zelená brána

## Auto-commit
- Fáze 50: CHANGELOG.md v /mini:done (`a10ba26554e91b144b97b56a0dc6b36ca53f6fbe`)

## Diskuse
# Fáze 50 — CHANGELOG.md v /mini:done

## Záměr
Zavést `CHANGELOG.md` ve formátu keepachangelog 1.1.0, plněný v rámci `/mini:done`
podle reportu hotové fáze. Pozn.: záměr se v diskusi rozšířil oproti uloženému cíli
(původně „jen prompt + snapshot test") — fáze teď sáhne i do `done.ts`.

Model (keepachangelog release flow):
- **Při každém `/mini:done`** (i bez pushe) Claude z reportu fáze doplní položky pod
  `## [Unreleased]` v `CHANGELOG.md` (sekce `Added` / `Changed` / `Fixed`). Soubor
  vytvoří, pokud chybí. Patche se takhle jen kumulují v Unreleased.
- **Překlopení Unreleased → vydaná sekce `## [<verze>] - <YYYY-MM-DD>` se děje jen
  při `--bump minor` / `--bump major` (a pushi).** Tool před commitem zaklapne
  obsah `## [Unreleased]` do `## [<verze>] - <datum>` (verze = ta, na kterou se
  zrovna bumplo → shoduje se s tagem `v<verze>`) a nad ni vloží novou prázdnou
  `## [Unreleased]`.
- **Při patchi (i s `--push`) se nestampuje** — položky zůstanou v `## [Unreleased]`
  a kumulují se až do dalšího minor/major vydání. Tím se „nepromítne každý patch"
  jako vlastní sekce.

## Klíčová rozhodnutí
- **Verzi do headingu stampuje tool, ne Claude.** Claude píše jen obsah pod
  `[Unreleased]`; jediný zdroj pravdy o verzi je `package.json` / bump v `--apply`,
  takže heading se nerozejde s gitovým tagem.
- **Stampování Unreleased → `[verze] - datum` se děje jen při `--bump minor`/`major`
  (s pushem)**, ne při patchi a ne při každém done. Patche zůstávají v Unreleased.
  (Uživatel výslovně odmítl variantu „sekce na každý patch".)
- Claude třídí položky z reportu do `Added` (nová funkce) / `Changed` (změna) /
  `Fixed` (oprava). Zdroj = `reportBody` + tituly kroků (už jsou v done promptu).
- Datum = dnešní (lokální), formát `YYYY-MM-DD`.

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

## Run report
---
phase: 50
verdict: done
steps:
  - title: "Modul changelog.ts + stamp funkce"
    status: done
  - title: "Napojení stampu do commitPhaseWork (done.ts)"
    status: done
  - title: "Instrukce o CHANGELOGu do done promptu"
    status: done
  - title: "Zelená brána"
    status: done
verify:
  - title: "Reálný end-to-end tok /mini:done s nainstalovaným mini"
    detail: "Logika je pokrytá testy (483 zelených), ale skutečné psaní CHANGELOG.md Claudem během /mini:done se projeví až po rebuildu/reinstalaci mini (mini běží z dist). Otázka: založit CHANGELOG.md pro tenhle projekt už teď, nebo ho nechat vzniknout při příštím /mini:done?"
---

# Fáze 50 — report z auto session

## Co se udělalo
Zavedl jsem podporu `CHANGELOG.md` (keepachangelog 1.1.0) napojenou na `/mini:done`.

- **`src/changelog.ts`** (nový): čistá funkce `stampUnreleased(content, version, date)`
  přejmenuje první `## [Unreleased]` na `## [<verze>] - <datum>` a nad ni vloží novou
  prázdnou `## [Unreleased]`. Prázdná/chybějící Unreleased = signál nestampovat
  (`StampResult.stamped/reason`) → idempotence. Plus `CHANGELOG_FILE` a `todayIso()`.
  Pokryto 7 unit testy (`src/changelog.test.ts`).
- **`src/commands/done.ts`**: v `commitPhaseWork` po bumpu a **před** `commitAll`
  best-effort zaklapnutí přes nový helper `stampChangelog`. Podmínka:
  `finalizeOpts.push && (level === 'minor' || level === 'major')`. Patch (i s pushem)
  a běh bez pushe nestampují — položky se kumulují v Unreleased. Chybějící/nestandardní
  CHANGELOG.md jen warning, done se nikdy nezablokuje. Pokryto 4 testy v `done.test.ts`
  (do git mocku jsem doplnil `push`/`createTag`/`pushTag`).
- **`src/prompts/sessionContext.ts`**: `buildDoneSessionPrompt` (jen když report existuje)
  dostal sekci `# CHANGELOG` — instruuje Claude před `mini done --apply` doplnit změny
  z reportu pod `## [Unreleased]` (`### Added`/`### Changed`/`### Fixed`) a verzi/datum
  **nedoplňovat** (to dělá tool při minor/major pushi). Pokryto 2 testy.

## Pozor / poznámky
- **Trigger stampování = `--push` + `--bump minor`/`major`** (dle upřesnění v diskuzi).
  Default patch neprodukuje datovanou sekci; tahle fáze se tedy při běžném
  `mini done --apply --push` (patch) jen přidá do Unreleased, datovaná sekce vznikne
  až u příštího minor/major vydání.
- Měření tokenů: done prompt povyrostl o CHANGELOG sekci → aktualizoval jsem 2 snapshoty
  v `src/tokens/__snapshots__/measure.test.ts.snap` (čekané, jen čísla).
- Projekt zatím `CHANGELOG.md` nemá — viz verify bod výše.

## Stav
Typecheck zelený, `npm test` = 483 testů zelených.
