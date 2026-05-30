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
