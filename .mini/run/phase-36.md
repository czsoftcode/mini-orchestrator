---
phase: 36
verdict: done
steps:
  - title: "applyStepDone (src/commands/do.ts) se líně nastartuje: když fáze není doing a zároveň není done/skipped, sám nastaví status doing, doplní startedAt (když chybí) a založí .mini/run/ přes ensureRunDir, pak teprve označí krok hotový; na done/skipped dál vrací chybu. Ověřitelné novými a upravenými testy v do.test.ts."
    status: done
  - title: "Testy v do.test.ts: přepsat původní \"odmítne zápis, když fáze není doing\" na done/skipped (dál odmítá) a přidat test, že z planned/todo fáze applyStepDone nastaví doing + vytvoří .mini/run/ + označí krok done. Ověřitelné: npm test zelené."
    status: done
  - title: "Command do v COMMAND_DEFS (src/commands/install-commands.ts) dostane vlastní body: na začátku spustit mini do --apply (nastartuje fázi), pak mini context do, implementovat, po každém kroku mini do --apply --step-done, na konci report do .mini/run/. Shared buildAutoPhasePrompt se nemění. Ověřitelné: renderCommandMd pro do obsahuje mini do --apply i pořadí kroků."
    status: done
  - title: "Testy v install-commands.test.ts: přidat/ upravit test, že do.md zmiňuje mini do --apply (init) a pořadí kroků; zkontrolovat, že seznam očekávaných souborů a idempotence stále sedí. Ověřitelné: npm test zelené."
    status: done
  - title: "Ověřit a přegenerovat: npm run typecheck + build + test zelené; node dist/cli.js install-commands a kontrola, že .claude/commands/mini/do.md má nový body s mini do --apply."
    status: done
---

# Fáze 36 — report z auto session

Cíl splněn: chyba, kvůli které první `mini do --apply --step-done` ve
slash-command cestě `/mini:do` spadl a vyžadoval druhé spuštění, je opravena
přístupem **A+B** (pásek i šle).

## Co se udělalo

- **B — robustní `applyStepDone`** (`src/commands/do.ts`):
  - Tvrdá pojistka `phase.status !== 'doing'` → chyba byla nahrazena líným
    startem. Když fáze není `doing` a zároveň **není** `done`/`skipped`, funkce
    ji sama nastartuje (`status = 'doing'`, doplní `startedAt`, `ensureRunDir`) a
    teprve pak označí krok hotový.
  - Na uzavřenou fázi (`done`/`skipped`) zápis dál odmítne — nově s důvodem
    `phase-closed` (dřív `phase-not-doing`).
  - Aktualizován doc komentář funkce.
- **A — vlastní body slash commandu `do`** (`src/commands/install-commands.ts`):
  - `do` v `COMMAND_DEFS` dostal vlastní `body` se 4 kroky v pořadí: 1) `mini do
    --apply` (init), 2) `mini context do`, 3) implementace + `mini do --apply
    --step-done` po každém kroku, 4) report do `.mini/run/phase-{id}.md`.
  - Naplňuje zdokumentovaný kontrakt `applyDoStart` („volá ho /mini:do před tím,
    než Claude začne pracovat"), který dosud nebyl zapojený.
  - Shared `buildAutoPhasePrompt` (`src/prompts/autoPhase.ts`) **zůstal beze
    změny** — používá ho i CLI auto, kde init proběhne v `doPhase()`.
- **Testy:**
  - `do.test.ts`: původní test „odmítne zápis, když fáze není doing" rozdělen na
    dva — (a) líný start z `planned` (ověřuje `doing` + `startedAt` + vznik
    `.mini/run/` + krok `done`), (b) odmítnutí na `done`/`skipped` s reason
    `phase-closed`.
  - `install-commands.test.ts`: nový test, že `do.md` obsahuje `mini do --apply`,
    `mini context do`, `mini do --apply --step-done`, `.mini/run/` a že init
    předchází `mini context do`.
- Přegenerováno `node dist/cli.js install-commands` → `.claude/commands/mini/do.md`
  má nový body.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **425 testů, 35 souborů** (předtím 423; −1 nahrazený test, +2 nové).
- `install-commands` idempotentní — druhý běh hlásí „8 commandů beze změny".
- Tato session sama posloužila jako manuální ověření opravy: protože stará `do.md`
  ještě bug obsahovala, spustil jsem `mini do --apply` ručně na začátku; všechny
  `--step-done` pak prošly napoprvé.

## Poznámky

- Po přeinstalaci mini (`npm run install-local`) a `mini install-commands` v
  cílových projektech bude `/mini:do` fungovat napoprvé i bez ručního `mini do
  --apply` — díky A (command init) i B (líný start jako záchranná síť).
- Drobnost mimo rozsah: při prvním běhu `install-commands` po rebuildu se v
  souhrnném řádku objevila nekonzistentní čísla („5 nových, 5 změněných" u 8
  souborů). Druhý běh hlásí korektně vše beze změny, takže stav je konzistentní;
  může jít o kosmetickou nepřesnost v počítadle nebo o zkomolený výstup terminálu
  v této session. Nechávám jako případný námět na pozdější fázi.
