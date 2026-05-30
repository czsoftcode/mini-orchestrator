# Changelog

Všechny podstatné změny v tomto projektu jsou zaznamenány zde. Formát vychází
z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) a projekt používá
[sémantické verzování](https://semver.org/lang/cs/).

## [Unreleased]

## [1.1.0] - 2026-05-30

### Added

- `/mini:done` nově vytváří a udržuje `CHANGELOG.md` ve formátu Keep a Changelog
  1.1.0: Claude z reportu hotové fáze zapisuje změny pod `## [Unreleased]`
  (sekce `Added` / `Changed` / `Fixed`). Při vydání s `--bump minor`/`major`
  a `--push` se obsah `## [Unreleased]` zaklapne do datované sekce
  `## [verze] - datum` (shodné s git tagem) a nahoru se vloží nová prázdná
  `## [Unreleased]`; patche se kumulují v `Unreleased` až do dalšího vydání.
