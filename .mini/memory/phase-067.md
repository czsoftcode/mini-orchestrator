# Fáze 67 — Příkaz mini:verify pro UI/UX

**Cíl:** Přidat interaktivní 'mini context verify' a slash command /mini:verify, který Claudovi dá prompt, jak člověka krok po kroku provést hloubkovou UI/UX kontrolou aktuální (právě dokončené) fáze: vyjde z 'verify' bodů run reportu, doplní širší UI/UX procházku, posbírá nálezy od člověka a zaznamená výsledek. Součástí je registrace verify v CONTEXT_COMMANDS, builder promptu v sessionContext.ts, větvení v context.ts, generování slash commandu v install-commands.ts, testy a krátká zmínka v README.

## Kroky
- [hotovo] buildVerifySessionPrompt v sessionContext.ts
- [hotovo] Registrace verify + resolve fáze v context.ts
- [hotovo] Slash command /mini:verify v install-commands.ts
- [hotovo] Testy promptu a routingu
- [hotovo] Doplnit verify do install-commands.test.ts
- [hotovo] Zmínka v README

## Auto-commit
- Fáze 67: Příkaz mini:verify pro UI/UX (`b7cd25a4856f889249c7ac898f3e74b35b37a25d`)

## Run report
---
phase: 67
verdict: done
steps:
  - title: "buildVerifySessionPrompt v sessionContext.ts"
    status: done
  - title: "Registrace verify + resolve fáze v context.ts"
    status: done
  - title: "Slash command /mini:verify v install-commands.ts"
    status: done
  - title: "Testy promptu a routingu"
    status: done
  - title: "Doplnit verify do install-commands.test.ts"
    status: done
  - title: "Zmínka v README"
    status: done
verify:
  - title: "Vyzkoušej /mini:verify naživo v Claude Code"
    detail: "Strojově je prompt ověřený (node dist/cli.js context verify vykreslí rámec, kroky i verify body). Lidský pohled: po /clear spustit /mini:verify a posoudit, jestli tě interaktivní vedení (ptaní po jednom, scéna → verify body → širší UX → nálezy) přijde v praxi srozumitelné a užitečné, ne otravné."
---

# Fáze 67 — report z auto session

## Co se udělalo
Přidán nový krok workflow **verify** pro hloubkovou UI/UX kontrolu fáze člověkem.

- **`buildVerifySessionPrompt`** v `src/prompts/sessionContext.ts` — builder promptu, který Claude vede interaktivní UI/UX kontrolou (připrav scénu → projdi verify body → rozšiř kontrolu → posbírej nálezy). Rozlišuje rámec pro rozdělanou (kontrola před `done`) vs. uzavřenou fázi (zpětná kontrola). Vykreslí verify body z reportu i kroky fáze. Je to **read-only** krok — stav neposouvá.
- **`context.ts`** — `verify` přidán do `CONTEXT_COMMANDS`; nová dispatch větev `buildVerifyContext`. Cílová fáze = `currentPhaseId`, jinak fallback na poslední fázi se statusem `done` (verify se typicky pouští i po `done`). Parsing verify bodů z run reportu vytažen do sdíleného helperu `readReportVerify` (reuse mezi `done` a `verify`).
- **`install-commands.ts`** — CommandDef `verify`; regenerován `.claude/commands/mini/verify.md` (přes `node dist/cli.js install-commands`, protože globální `mini` je stará verze 1.3.0).
- **Testy** — `sessionContext.test.ts` (6 nových: rámec rozdělané/uzavřené fáze, verify body, fallback na kroky, volný text), `context.test.ts` (routing: chybějící fáze → exit 1, aktuální fáze, fallback na poslední done, verify body z reportu; upraven test obsahu `CONTEXT_COMMANDS`), `install-commands.test.ts` (verify.md ve výčtu + obsah), `update.test.ts` (počet commandů 10 → 11).
- **README** — `mini verify` do tabulky příkazů, `verify` do výčtu `mini context`, do seznamu generovaných souborů a `/mini:verify` mezi slash commandy.

Celá suite: **642 testů zelených**, build OK.

## Na co dát pozor
- **Globální `mini` (1.3.0) neukazuje na lokální build** — slash commandy a `mini context verify` je potřeba pouštět přes `node dist/cli.js …`, dokud se globální binárka nezaktualizuje. Po vydání nové verze to bude OK.
- `verify` je čistě **read-only** a stav neposouvá — záměrně. Posun dělá dál `done`. Krok ve workflow sedí mezi `do` a `done`, nebo jako zpětná kontrola po `done`.

## Otevřené konce
- Zatím se `/mini:verify` nezačleňuje do autonomního `/mini:auto` cyklu (zůstává jako ruční doplněk). Případné napojení = samostatná fáze.
