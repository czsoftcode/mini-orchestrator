# Fáze 42 — Step.detail v modelu a v plan

**Cíl:** Rozšířit Step o volitelné pole detail (kritéria/'Ověřitelné'), aby title zůstal krátký kanonický identifikátor; mini plan --apply přijme a uloží title + detail zpětně kompatibilním stdin formátem (řádek bez oddělovače = jen title) a slash /mini:plan prompt navede na krátký title + samostatný detail. Renderery promptů (auto/do/discuss/writeMemory) a párování reportu zůstávají na title beze změny. Ověřitelné: typecheck, unit testy parsování plan --apply (s detailem i bez), aktualizovaný snapshot plan promptu.

## Kroky
- [hotovo] Přidat Step.detail do typu Step
- [hotovo] Stdin parser plan --apply na title + detail
- [hotovo] applyPlanSteps a cli.ts ukládají detail
- [hotovo] Slash plan prompt: krátký title + detail

## Auto-commit
- Fáze 42: Step.detail v modelu a v plan (`99bba32893623a0bb34ccbc3def17670ae14390b`)

## Pozor na

- `runReport.ts:207-220` páruje report ↔ stav **přesnou shodou množin titulů**.
  Dokud zůstává párování na `title` (a tato fáze ho nemení), nesmí se rozbít.
- Báze pro navazující fáze (mimo rozsah 42, ale ať plan/do ví, kam to směřuje):
  1) vykreslit `detail` v sekci "Kroky" auto/do promptu (a `measure.ts`
     `stepsText` o detail rozšířit, ať měření odpovídá realitě),
  2) udržet klon ve `sampleSteps` jen na `title` (už dnes klonuje jen title —
     takže s krátkými tituly je duplikace levná; původní "fáze 42 dedup" se tím
     stává skoro zbytečnou),
  3) případná migrace/zkrácení starých titulů — volitelné.
- Testy/snapshoty: `Step` je v `state/types.ts`; změna parsování v
  `commands/plan.ts` (`--apply` větev, `:179`); plan prompt v
  `prompts/sessionContext.ts` má snapshot `__snapshots__/planPhase.test.ts.snap`
  resp. test v `sessionContext.test.ts` — počítat s jejich aktualizací.
- Brána zelená: `npm run typecheck`, `npm test` (nové unit testy parsování
  `plan --apply` s detailem i bez), `npm run build`.

## Pozor / poznámky

- **Renderery a parser reportu se NEMĚNILY** (dle rozsahu fáze) — `detail` se
  zatím jen ukládá, nikde se nevykresluje. Vykreslení `detail` v sekci „Kroky"
  auto/do promptu + rozšíření `measure.ts` `stepsText` je navazující fáze.
  Teprve tam se projeví slíbená úspora na bloku „kroky".
- **Drobná ironie:** plan prompt se prodloužil (měřená šablona `plan`
  221→362 tok ve fixních vstupech `measure.test.ts`), protože přibyl návod ke
  dvoudílnému formátu. Je to jednorázový fixní náklad šablony; úspora přijde
  plošně v dalších fázích, až budou tituly krátké.
- **Edge case oddělovače:** `trim()` smaže koncovou mezeru, takže visící
  oddělovač `title ::` (prázdný detail) ` :: ` netrefí — ošetřeno zvlášť
  (`endsWith(' ::')` → jen title). Vedoucí prázdný title (`:: detail`) je přes
  trim nedosažitelný, guard je tam jen defenzivně.
- `.mini/token-report.md` jsem nepřegeneroval — cíl fáze to nevyžaduje a
  renderery „kroků" se neměnily (plan šablona by se posunula, ale to není
  předmět této fáze).
