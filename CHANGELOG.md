# Changelog

Všechny podstatné změny v tomto projektu jsou zaznamenány zde. Formát vychází
z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) a projekt používá
[sémantické verzování](https://semver.org/lang/cs/).

## [Unreleased]

### Added

- Mapa znalostního grafu nově podporuje **Go** (`.go`): z balíčku se vytáhnou
  importy (single i blokový `import ( … )` vč. aliasů, `_` blank a `.` dot importů)
  a top-level exporty — funkce se signaturou, `struct`/`interface`, typové aliasy
  a `const`/`var` (i seskupené), exportované podle velkého počátečního písmene.
  Metody se připojují k receiver typu, vše s kotvami na řádky. Projekt se rozpozná
  i podle `go.mod`.

## [1.2.0] - 2026-05-30

### Added

- Mapa znalostního grafu nově podporuje **Python** (`.py`/`.pyi`): z modulu se
  vytáhnou importy (`import`, `from ... import` vč. relativních, aliasů, `*` a
  víceřádkových) a top-level exporty — funkce (`def`/`async def`) se signaturou,
  třídy s veřejnými metodami a UPPER_CASE/anotované konstanty, s kotvami na řádky.
  Projekt se rozpozná i podle `pyproject.toml`/`setup.py`; `.venv/` a
  `__pycache__/` se ignorují.

## [1.1.0] - 2026-05-30

### Added

- `/mini:done` nově vytváří a udržuje `CHANGELOG.md` ve formátu Keep a Changelog
  1.1.0: Claude z reportu hotové fáze zapisuje změny pod `## [Unreleased]`
  (sekce `Added` / `Changed` / `Fixed`). Při vydání s `--bump minor`/`major`
  a `--push` se obsah `## [Unreleased]` zaklapne do datované sekce
  `## [verze] - datum` (shodné s git tagem) a nahoru se vloží nová prázdná
  `## [Unreleased]`; patche se kumulují v `Unreleased` až do dalšího vydání.
