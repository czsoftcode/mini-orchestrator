# Fáze 72 — Aktualizace README dle skutečnosti

**Cíl:** Projít aktuální stav projektu (s oporou v .mini/codebase.md) a uvést README.md do souladu se skutečností — opravit a odstranit zastaralé informace.

## Kroky
- [hotovo] Úvod a tvrzení o souborech
- [hotovo] Doplnit chybějící příkazy do tabulky
- [hotovo] Opravit memory napříč README
- [hotovo] Aktualizovat strom souborů v projektu
- [hotovo] Doplnit verzování, CHANGELOG a tag
- [hotovo] Finální průchod a kontrola

## Auto-commit
- Fáze 72: Aktualizace README dle skutečnosti

## Run report
---
phase: 72
verdict: done
steps:
  - title: "Úvod a tvrzení o souborech"
    status: done
  - title: "Doplnit chybějící příkazy do tabulky"
    status: done
  - title: "Opravit memory napříč README"
    status: done
  - title: "Aktualizovat strom souborů v projektu"
    status: done
  - title: "Doplnit verzování, CHANGELOG a tag"
    status: done
  - title: "Finální průchod a kontrola"
    status: done
---

# Fáze 72 — report z auto session

Aktualizoval jsem `README.md`, aby odpovídal skutečnému stavu kódu. Vyšel jsem z `.mini/codebase.md` a u nejistých tvrzení ověřil přímo zdroják (`src/commands/writeMemory.ts`, `src/prompts/writeMemory.ts`, `src/cli.ts`).

## Co se opravilo
- **Úvod** — nepřesné „jen dva soubory na projekt (project.md + state.json)" → minimální stav (project.md + lehká hlavička state.json + detail fází v `.mini/phases/`), v duchu úspory tokenů.
- **Tabulka příkazů** — doplněny chybějící `mini stop`, `mini migrate`, `mini update` (ověřeno proti `.command(...)` v `src/cli.ts` — výčet teď sedí).
- **Memory** — opravený zastaralý název `phase-{id}-{timestamp}.md` na skutečné `phase-{id}.md` (kolizní sufix `-2`/`-3`); `last-memory.md` už není symlink, ale **krátké shrnutí** nejnovějšího záznamu (starý symlink se v kódu maže). Doplněno i to, že memory se ve výchozím stavu skládá v TS bez volání Clauda (Claude jen při explicitním `memory` scope). Opraveno na všech místech: řádek `mini done` v tabulce, blok „Soubory v projektu", FAQ.
- **Strom souborů** — doplněn v2 layout: `phases/phase-{id}.json`, `graph.json` + `graph/<cesta>.md`, zmínka o `.mini/STOP`; popisky `state.json`/`state.prev.json` uvedeny do souladu (hlavička + záloha přes `phases-prev/`).
- **Verzování/CHANGELOG/tag** — doplněno do popisu `done` a nové FAQ „Bump verze, CHANGELOG a tag?": default `--bump none`, `--bump patch|minor|major`, zaklapnutí `## [Unreleased]` u minor/major, `--push` → git tag `v<verze>` a že `--push` vyžaduje explicitní bump.

## Ověření
- Šlo o čistě dokumentační změnu (jen `README.md`), žádný kód ani build se nedotkl, takže nebylo co spouštět/testovat.
- Zkontroloval jsem interní kotvy odkazů (`#strojová-mapa-projektu-graf`, `#autonomní-miniauto`, `#auto-režim`) — všechny míří na existující nadpisy.
- Ověřil jsem konzistenci výčtů (slash commandy, scope modelů, CLI `mini auto` = 4 kroky bez verify) proti codebase.md i zdrojákům.

Fáze čistě dokumentační, bez nutnosti UI/UX verify nad rámec přečtení textu.
