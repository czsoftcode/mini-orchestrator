# Fáze 43 — Vykreslit detail kroků v promptu

**Cíl:** V sekci „Kroky" auto i do promptu vypsat Step.detail odsazeně pod title (jen když je vyplněn) a rozšířit measure.ts stepsText o detail, aby měření tokenů odpovídalo realitě; sampleSteps ve vzorovém YAML reportu zůstává jen na title. Ověřitelné: typecheck, unit testy + aktualizované snapshoty auto/do promptu a měření, build.

## Kroky
- [hotovo] detail v auto promptu
- [hotovo] detail v do promptu
- [hotovo] detail v measure.stepsText
- [hotovo] Aktualizovat snapshoty + zelená brána

## Auto-commit
- Fáze 43: Vykreslit detail kroků v promptu (`3abb53cdd763fd92d422a178a39a47f6c979fafb`)

## Pozor na

- **Snapshoty k aktualizaci:** `prompts/__snapshots__/autoPhase.test.ts.snap`,
  `prompts/__snapshots__/doPhase.test.ts.snap`,
  `tokens/__snapshots__/measure.test.ts.snap`. Pozor: stávající fixtury
  (`autoPhase.test.ts` BASE_PHASE, `doPhase.test.ts`, `measure.test.ts`
  SAMPLE_PHASE) mají kroky **bez detailu** — jejich snapshoty by se proto
  ideálně neměly hnout (potvrdí, že krok bez detailu = beze změny). Doplnit
  **nový** test/fixturu s krokem, co detail má, ať se nová větev pokryje.
- `do`/`auto` snapshoty mají víc variant (retry, ref módy) — projet `npm test`
  a zkontrolovat, že se hnuly jen ty, které mají kroky s detailem.
- Nepleť `Step.detail` (plánovací) s `verify[].detail` v reportu
  (`sessionContext.ts:177`, `measure.ts:247`) — to je jiná věc, nesahat.
- Brána zelená: `npm run typecheck`, `npm test`, `npm run build`.
- `.mini/token-report.md` lze po fázi přegenerovat (`npm run measure-tokens`)
  — teď se blok „kroky" reálně zlevní u krátkých titulů; volitelné.

## Poznámky / na co dát pozor

- **Incident s `git stash` během session:** omylem spuštěný `git stash`
  odložil rozpracované změny; následný `git stash pop` způsobil konflikt
  v `.mini/state.json` a `.mini/phases/phase-042.json`. Vyřešeno převzetím
  stashed strany (`git checkout --theirs`). Po opravě `mini status` ukazuje
  korektní stav (fáze 42 hotová, fáze 43 dělá se, všechny 4 kroky hotové),
  JSON bez konfliktních markerů, zdrojový kód i testy beze ztráty.
  **Doporučení:** před commitem projet `git diff`, ať se nepropašuje nic
  neočekávaného (zejména v `.mini/`).
- `.mini/token-report.md` jsem nepřegeneroval (volitelné) — teď by blok „kroky"
  reálně zlevnil u krátkých titulů s detailem mimo report.
