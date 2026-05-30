---
phase: 63
verdict: done
steps:
  - title: "Neinteraktivní mini init přes flagy"
    status: done
  - title: "Guard existujícího projektu bez --force"
    status: done
  - title: "Brownfield-aware nabídka po init"
    status: done
  - title: "CLI wiring nových flagů initu"
    status: done
  - title: "Slash command /mini:init"
    status: done
  - title: "Testy"
    status: done
verify:
  - title: "Reálné chování /mini:init v Claude Code session"
    detail: "Strojově ověřeno CLI (mini init --apply, guard, brownfield, chybný flag) i jednotkovými testy. Sám slash flow v živé session (Claude se zeptá na 4 věci → spustí příkaz → nabídne /mini:map a /mini:audit) jsem nespouštěl — vyžaduje lidský průchod."
---

# Fáze 63 — report z auto session

## Co se udělalo
Přidán příkaz `/mini:init`, který umožní inicializovat projekt přímo z Claude Code.

- **`src/commands/init.ts`** — nový export `applyInit(opts)`: neinteraktivní založení projektu z flagů (žádné `ask` prompty). Zapíše `project.md` + `state.json` + skeleton (`syncSkeleton`). Guard: existující `.mini/state.json` bez `--force` → chyba + hint a `{ ok: false }`; s `--force` přepíše. Na rozdíl od interaktivní cesty **nespouští audit sám** — po uložení jen zjistí brownfield (`isBrownfield`) a vypíše doporučené další kroky (greenfield → `mini next`; brownfield → `mini map`, pak `mini audit`). Interaktivní `init()` zůstal beze změny.
- **`src/cli.ts`** — `mini init` dostal flagy `--apply/--name/--what/--for-whom/--constraints/--force`. S `--apply` validuje povinné `--what` a `--for-whom` přes `requireOption` a volá `applyInit`; jinak běží původní interaktivní `init()`.
- **`src/commands/install-commands.ts`** — do `COMMAND_DEFS` přibyly dva commandy:
  - `init` (vlastní tělo): nabádá Clauda zeptat se na 4 věci, spustit `mini init --apply …` (s `--force` jen po potvrzení) a podle brownfieldu nabídnout `/mini:map` + `/mini:audit`, nebo `/mini:next`.
  - `audit` (tenké tělo jako `map`): pustí `mini audit`. Doplněn, aby nabídka z `/mini:init` vedla na živý slash command (dřív neexistoval).
  Závěrečný hint rozšířen o `/mini:init` a `/mini:audit`.
- **README.md** — aktualizovaný seznam slash commandů (přidán `/mini:init` a `/mini:audit`).
- Vygenerovány reálné `.claude/commands/mini/init.md` a `audit.md` (přes `node dist/cli.js install-commands`).

## Testy
- `init.test.ts` — doplněny testy `applyInit`: zápis souborů + skeleton; default názvu z adresáře + placeholder omezení; guard bez `--force`; přepis s `--force`; brownfield nabídka (`mini map`/`mini audit`) ve výstupu.
- `install-commands.test.ts` — seznam souborů (10 commandů, vč. `init.md`/`audit.md`), test obsahu `init.md` (volá `mini init --apply`, nabízí `/mini:map` + `/mini:audit`), test `audit.md` (volá `mini audit`), idempotence rozšířena.
- `update.test.ts` — počet commandů 8 → 10.
- Celá sada: **617 testů zelených**, build OK.

## Rozhodnutí mimo úzké zadání
Goal nabízel `/mini:audit`, ale ten slash command dosud neexistoval (existoval jen CLI `mini audit`). Aby nabídka z `/mini:init` nevedla na mrtvý odkaz, přidal jsem i `/mini:audit` jako tenký command (obdoba `/mini:map`). Greenfield po init nabízí `mini next` (ne map/audit) — mapovat/auditovat prázdný adresář nedává smysl.
