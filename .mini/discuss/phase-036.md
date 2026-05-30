# Fáze 36 — Oprava chyby prvního mini do --apply

## Záměr
Ve slash-command cestě `/mini:do` první `mini do --apply --step-done "<krok>"`
spadne s chybou „Fáze X není rozdělaná (stav: …). Nejdřív spusť: mini do --apply"
a teprve po ručním spuštění `mini do --apply` druhý pokus projde.

Příčina (ověřeno v kódu):
- `do.md` používá **generický body** → spustí jen `mini context do`, nikdy
  nezavolá `mini do --apply` (`applyDoStart`), který fázi přepne na `doing`.
- `mini context do` vypíše `buildAutoPhasePrompt` (`src/prompts/autoPhase.ts`),
  který instruuje `mini do --apply --step-done`, ale neřekne, že nejdřív musí
  proběhnout `mini do --apply`.
- `applyStepDone` (`src/commands/do.ts:281`) tvrdě vyžaduje `phase.status === 'doing'`.

V CLI cestě (`mini do` / `mini auto`) bug není — `doPhase()` si `doing` +
`ensureRunDir` nastaví sám (`do.ts:116–129`). Chybí to **jen** ve slash-command
cestě.

## Klíčová rozhodnutí
Zvolen přístup **A+B** (pásek i šle — odolné vůči tomu, jak se `/mini:do` zavolá):

**A — slash command spustí `mini do --apply` na začátku.**
- Dát commandu `do` v `COMMAND_DEFS` (`src/commands/install-commands.ts`) vlastní
  `body` v pořadí:
  1. `mini do --apply` (nastartuje fázi — status `doing` + `.mini/run/`),
  2. `mini context do` (vypíše prompt),
  3. implementace; po každém hotovém kroku `mini do --apply --step-done "<název>"`,
  4. na konci zapsat report do `.mini/run/phase-{id}.md`.
- Naplňuje zdokumentovaný kontrakt `applyDoStart` („volá ho /mini:do před tím, než
  Claude začne pracovat").
- Shared `buildAutoPhasePrompt` **neměnit** — používá ho i CLI auto, kde init už
  proběhl; instrukci na `mini do --apply` drží jen do.md body.

**B — `applyStepDone` se líně nastartuje, když fáze ještě není `doing`.**
- Když `phase.status` není `doing`:
  - je-li `done` nebo `skipped` → dál odmítni (jako teď),
  - jinak (`planned`/`todo`/…) → sám nastav `status = 'doing'`, doplň `startedAt`
    (když chybí) a `ensureRunDir`, pak teprve označ krok hotový.
- Odstraní závislost na pořadí úplně — i kdyby A selhalo nebo se command zavolal
  ručně, `--step-done` projde napoprvé.

## Pozor na
- **Existující test** `do.test.ts:162` „odmítne zápis, když fáze není doing"
  (nastavuje status `planned`) se musí přepsat: nově má `applyStepDone` z
  `planned` fázi sám nastartovat a krok označit. Refuse ponechat jen pro
  `done`/`skipped` — na to přidat nový test.
- Přidat regresní testy:
  - `applyStepDone` z `planned`/`todo` fáze → nastaví `doing`, založí `.mini/run/`,
    označí krok `done` (ověřit oba efekty),
  - `applyStepDone` na `done`/`skipped` fázi → dál vrací chybu.
- `install-commands.test.ts`: do `do.md` přibude vlastní body → upravit/přidat
  test, že `do.md` zmiňuje `mini do --apply` (init) i pořadí kroků. Pozor na
  idempotenci a na seznam očekávaných souborů.
- Po změně COMMAND_DEFS přegenerovat slash commandy: `node dist/cli.js
  install-commands` a ověřit nový obsah `.claude/commands/mini/do.md`.
- `applyDoStart` je idempotentní (opětovné volání na `doing` fázi je neškodné),
  takže A+B se nebijí.
- Ověřit `npm run typecheck` + `build` + `test`.
