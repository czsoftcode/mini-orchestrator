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
