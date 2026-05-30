---
phase: 65
verdict: done
steps:
  - title: "Přepsat auto definici v COMMAND_DEFS — smyčka přes víc fází"
    status: done
  - title: "Tělo auto.md — interaktivní zastávky a tichý běh"
    status: done
  - title: "Tělo auto.md — stop háčky pro budoucí fázi 66"
    status: done
  - title: "Permissions — settings.json allowlist a --yolo dokumentace"
    status: done
  - title: "Testy, regenerace a README"
    status: done
verify:
  - title: "Reálný běh /mini:auto --max-phases 2 v Claude Code"
    detail: "Změny jsou v textu slash commandu (auto.md) + allowlistu — strojově ověřeno testy a buildem, ale skutečné chování autonomní smyčky (zastávky u next/discuss/verify, tichý běh, konec po N fázích) jde potvrdit jen reálným spuštěním /mini:auto v session. Doporučuju zkusit --max-phases 2 na nějaké malé fázi."
---

# Fáze 65 — report z auto session

## Co se udělalo
Rozšířen slash command `/mini:auto` na **autonomní režim** přes víc fází. Klíčové zjištění: `auto.md` se negeneruje ručně, je to výstup z `COMMAND_DEFS` v `src/commands/install-commands.ts` — měnila se tedy definice tam a `.claude/commands/mini/auto.md` se přegeneroval přes `install-commands`.

Konkrétně:
- **`src/commands/install-commands.ts`** — nová `auto` definice: `argumentHint: '[--max-phases N] [--yolo]'`, tělo popisuje autonomní smyčku `next → discuss(podmíněně) → plan → do → done → opakuj`, parsování `--max-phases` (default 1) a `--yolo` z `$ARGUMENTS`, interaktivní zastávky (next/discuss/verify), tichý běh u `do`, detekci hotového projektu (TITLE: -), čtyři hranice konce běhu a **stop háčky** (kontrola `.mini/STOP` mezi kroky cyklu i po každém `--step-done`) jako příprava pro fázi 66.
- **`.claude/settings.json`** (nový) — allowlist pro `mini:*`, build/test (`npm run build/test`, `npx vitest`) a běžné git příkazy, aby autonomní běh neotravoval s potvrzováním.
- **`src/commands/install-commands.test.ts`** — přejmenovaný stávající auto test (next přidán do sekvence) + 2 nové testy: argument-hint/`--max-phases`/`--yolo`/tichý běh/TITLE:- a stop háčky.
- **`README.md`** — nová sekce „Autonomní `/mini:auto`" + doplnění slash command přehledu o auto/map/status.
- Přegenerován `.claude/commands/mini/auto.md` přes `node dist/cli.js install-commands`.

## Ověřeno strojově
- Celá test suite: **627 passed, 0 failed** (174 suites).
- `npm run build` (tsc + copy-assets) prošel.
- `auto.md` má správný frontmatter (description + argument-hint) a obsahuje `--max-phases`, `--yolo`, `.mini/STOP`, `TITLE: -`.

## Pozor na / otevřené konce
- **Permissions v slash režimu:** `.claude/settings.json` allowlist potlačí potvrzování jen pro vyjmenované příkazy. `--yolo` reálně funguje jen v session spuštěné s `--permission-mode acceptEdits` — slash command sám potvrzování nevypne. Zdokumentováno v auto.md i README.
- **Stop je zatím jen dokumentovaný háček** — `.mini/STOP` se nikde nezapisuje. Samotný `mini stop` (CLI) je naplánovaný jako fáze 66.
- **CLI `mini auto` (Node) zůstalo beze změny** — pořád dotahuje jednu fázi přes spawn Clauda. Slash a CLI varianta jsou teď záměrně oddělené (popsáno v README). Případné sjednocení je mimo scope.
