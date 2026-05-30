# Fáze 68 — Verify v auto + zápis nálezů

**Cíl:** Do auto cyklu vložit krok verify mezi do a done (u UI/UX fází dle úsudku Claudu, nebo vynuceně přes nový flag --verify), nechat verify zapisovat nálezy do run reportu (a tím i do paměti přes buildPhaseMemoryMarkdown) a opravit je ještě v téže fázi před uzavřením; buildVerifySessionPrompt přestane být read-only.

## Kroky
- [hotovo] buildVerifySessionPrompt zapisuje nálezy
- [hotovo] Flag --verify v auto.md
- [hotovo] Krok verify mezi do a done v auto.md
- [hotovo] Testy install-commands a verify promptu
- [hotovo] README zmínka

## Auto-commit
- Fáze 68: Verify v auto + zápis nálezů (`e35eebf61bd397c5db6de539155ac8076b872e68`)

## Run report
---
phase: 68
verdict: done
steps:
  - title: "buildVerifySessionPrompt zapisuje nálezy"
    status: done
  - title: "Flag --verify v auto.md"
    status: done
  - title: "Krok verify mezi do a done v auto.md"
    status: done
  - title: "Testy install-commands a verify promptu"
    status: done
  - title: "README zmínka"
    status: done
verify:
  - title: "Vyzkoušej verify v auto cyklu a /mini:auto --verify naživo"
    detail: "Strojově je vše ověřené (647 testů zelených, auto.md i verify prompt vygenerované správně). Lidský pohled: spustit /mini:auto na UI/UX fázi a posoudit, jestli (a) Claude správně rozpozná UI/UX fázi a verify spustí (a u vnitřní fáze přeskočí), (b) /mini:auto --verify verify vynutí i jinde, (c) nálezy z verify se opravdu zapíšou do .mini/run/phase-{id}.md a přes report i do paměti, (d) případné problémy se opraví ještě v téže fázi před done. Posuď, jestli je tok do→verify→(oprava)→done v praxi srozumitelný a ne otravný."
---

# Fáze 68 — report z auto session

## Co se udělalo
Verify se napojil do autonomního `auto` cyklu a začal zapisovat nálezy.

- **`buildVerifySessionPrompt`** (`src/prompts/sessionContext.ts`) — přestal být read-only. Po interaktivní kontrole teď Claude **zapíše nálezy** do run reportu (`## Nálezy z verify` pod YAML hlavičkou) — odtud je `buildPhaseMemoryMarkdown` vloží i do paměti. U už uzavřené fáze (`phaseDone`) nálezy navíc připisuje do existujícího memory souboru (report už paměť zpětně nepřevezme). Nový vstup `reportExists` řídí, jestli report doplnit, nebo založit. Stav fáze prompt dál **neposouvá** (to je `done`).
- **`context.ts`** — `buildVerifyContext` předává `reportExists` do promptu.
- **`install-commands.ts`** (CommandDef `auto`) — argument-hint `[--max-phases N] [--yolo] [--verify]`; nový argument `--verify` (vynutí verify v každé fázi); nový **krok 5 cyklu „verify (podmíněně)"** mezi `do` a `done` (Claude posoudí UI/UX povahu z cíle/kroků/reportu, nebo ho vynutí `--verify`; u vnitřní fáze přeskočí; nálezy → report; problémy se opraví ještě v téže fázi před `done`); `done` přečíslováno na krok 6; aktualizovaný úvodní výčet cyklu. Stop-háčky verify pokrývají automaticky („mezi kroky cyklu — před každým `mini context …`"). Přegenerován `.claude/commands/mini/auto.md`.
- **Testy** — `sessionContext.test.ts` (verify: zápis nálezů do reportu, založení reportu když chybí, zápis do paměti u uzavřené fáze, žádný zápis do paměti u rozdělané; všechny volání doplněny o `reportExists`); `install-commands.test.ts` (auto.md obsahuje krok verify, `--verify`, UI/UX, „přeskoč" a verify předchází done). Celá suite: **647 testů zelených**, build OK.
- **README** — řádek `mini verify` (zápis nálezů místo „read-only"), `/mini:verify` a `/mini:auto` (`--verify`), sekce „Autonomní `/mini:auto`" (verify v cyklu, `--verify`, zastavení u verify).

## Na co dát pozor
- **Globální `mini` (1.3.0) neukazuje na lokální build** — `install-commands` i `mini context verify` je potřeba pouštět přes `node dist/cli.js …`, dokud se globální binárka nezaktualizuje (`mini ... --apply` pro stav funguje i ze staré verze).
- Verify pro **už uzavřenou fázi** zapisuje nálezy do paměti **ručně** (Claude edituje memory soubor) — report ji zpětně nepřegeneruje. U běžného toku v auto (verify před `done`) jde vše čistě přes report.

## Otevřené konce
- UI/UX detekce je **úsudek Claudu** v promptu (bez metadat na fázi) — záměrně dle dohody. Kdyby se ukázala jako nespolehlivá, šlo by doplnit explicitní příznak `uiux` na fázi (samostatná fáze).
