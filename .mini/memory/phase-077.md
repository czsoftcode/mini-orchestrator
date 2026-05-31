# Fáze 77 — Překlad slash-command .md do AJ

**Cíl:** Přeložit do angličtiny popisy a těla commandů v install-commands.ts (vč. výchozí šablony těla), aktualizovat install-commands.test.ts a přegenerovat nainstalované .claude/commands/mini/*.md; npm test a build zelené.

## Kroky
- [hotovo] Přeložit COMMAND_DEFS + výchozí tělo
- [hotovo] Upravit install-commands.test.ts
- [hotovo] Přegenerovat .claude/commands/mini/*.md
- [hotovo] Doplnit slovníček + ověřit

## Auto-commit
- Fáze 77: Překlad slash-command .md do AJ

## Run report
---
phase: 77
verdict: done
steps:
  - title: "Přeložit COMMAND_DEFS + výchozí tělo"
    status: done
  - title: "Upravit install-commands.test.ts"
    status: done
  - title: "Přegenerovat .claude/commands/mini/*.md"
    status: done
  - title: "Doplnit slovníček + ověřit"
    status: done
---

# Fáze 77 — report z auto session

## Co se udělalo
- **`src/commands/install-commands.ts` přeložen do angličtiny** — všech 11
  `description`, vlastní těla (init/do/status/map/audit/auto), `argumentHint`
  (`[volitelný nápad na fázi]`→`[optional phase idea]`) i výchozí šablona těla
  workflow commandů v `renderCommandMd`.
- **Beze změny** (strojové/identifikátory): příkazy a flagy (`mini context …`,
  `mini … --apply`, `--max-phases`, `--yolo`, `--verify`, `--discuss`,
  `--step-done`), `$ARGUMENTS`, `TITLE: -`, cesty (`.mini/STOP`, `.mini/run/`).
- **Logy CLI** v `installCommands` (`Vytvořeno`/`Aktualizováno`/`Hotovo`/hint)
  ponechány **česky** — to je UI projektu (dle CLAUDE.md), ne text pro Claude.
- **`install-commands.test.ts`**: přepsány české `toMatch` regexy na anglické
  (`condition|only when|only if`, `autonom`, `edit listing|don't print`, `skip`,
  `between cycle steps`); ostatní aserce (`mini context`, `$ARGUMENTS`, flagy,
  `description:`, `.mini/STOP`, `TITLE: -`) beze změny.
- **Přegenerovány `.claude/commands/mini/*.md`** — pozor: globální `mini` je
  nainstalovaná verze 1.4.1 (`~/.local/share/mini/...`), ne tenhle repo. Regenerace
  proto proběhla lokálním buildem: `node dist/cli.js install-commands` (11 souborů
  aktualizováno, druhý běh „beze změny" = idempotentní).
- Slovníček `docs/i18n-glossary.md` doplněn o sekci slash-commandů.

## Ověření (strojově)
- `npx vitest run install-commands.test.ts` → 16 testů zelených.
- `npm test` → 50 souborů, 651 testů, vše zelené.
- `npm run build` → tsc + copy-assets bez chyb.
- Idempotence regenerace ověřena (druhý běh 0 změn).
- Nainstalované `.md` ověřeny anglicky (např. `next.md` description + tělo).

## Na co dát pozor / otevřené
- Skill/command popisy v Claude Code se po regeneraci zobrazují anglicky (viz
  system reminder v session) — projevilo se hned.
- Drobnost: globální `mini` zůstává na 1.4.1; nové anglické prompty/commandy z repa
  se do něj dostanou až dalším vydáním (`done --push` s bumpem) a reinstalací.
