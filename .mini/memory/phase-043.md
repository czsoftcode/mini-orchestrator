# Fáze 43 — Vykreslit detail kroků v promptu

**Cíl:** V sekci „Kroky" auto i do promptu vypsat Step.detail odsazeně pod title (jen když je vyplněn) a rozšířit measure.ts stepsText o detail, aby měření tokenů odpovídalo realitě; sampleSteps ve vzorovém YAML reportu zůstává jen na title. Ověřitelné: typecheck, unit testy + aktualizované snapshoty auto/do promptu a měření, build.

## Kroky
- [hotovo] detail v auto promptu
- [hotovo] detail v do promptu
- [hotovo] detail v measure.stepsText
- [hotovo] Aktualizovat snapshoty + zelená brána

## Auto-commit
- Fáze 43: Vykreslit detail kroků v promptu (`3abb53cdd763fd92d422a178a39a47f6c979fafb`)

## Diskuse
# Fáze 43 — Vykreslit detail kroků v promptu

## Záměr

Dotáhnout split z fáze 42: `Step.detail` (`state/types.ts:15`) se dnes ukládá,
ale nikde nevykresluje, takže slíbená úspora na bloku „kroky" se ještě
neprojevila. Tahle fáze detail **zobrazí** ve správných promptech a srovná
měření tokenů s realitou.

Konkrétně:
1. **auto prompt** — `buildAutoPhasePrompt` (`prompts/autoPhase.ts:72-78`),
   blok `stepsBlock`. Dnes `- [stav] ${s.title}`. Přidat detail odsazeně pod
   title, jen když je vyplněn.
2. **do prompt** — `buildDoPhasePrompt` (`prompts/doPhase.ts:20-29`),
   `stepsBlock`. Pozor: tady řádek navíc nese marker `← pracuj na tomhle`
   u `focusedStep` — detail vykreslit tak, aby s markerem nekolidoval
   (marker zůstává na řádku s title, detail jde na další odsazený řádek).
3. **measure.ts `stepsText`** (`tokens/measure.ts:116-119`) — zahrnout detail,
   ať změřená cena bloku „kroky" odpovídá tomu, co se reálně posílá.

## Klíčová rozhodnutí

- **`sampleSteps` zůstává jen na `title`** (`autoPhase.ts:117-124`). To je
  jádro úspory: report klonuje krátké tituly, dlouhý detail je v kontextu
  jen jednou (v `stepsBlock`). Nesahat na to.
- **Formát vykreslení detailu (rozhodnuto):** detail na samostatném odsazeném
  řádku pod title — `- [stav] title` + nový řádek `    detail` (4 mezery).
  Inline pomlčka zamítnuta (mísila by se s dlouhým detailem i s markerem
  `← pracuj na tomhle`). V `do` promptu marker zůstává na řádku s title,
  detail jde na další řádek pod ním. Vykreslit **jen když `s.detail`** je
  neprázdný — krok bez detailu musí zůstat bít po bitu stejný jako dnes
  (zpětná kompatibilita + malá diff na snapshotech).
- **Rozsah:** jen `auto` + `do` prompt + `measure.stepsText`. `discussPhase`,
  `writeMemory`, `sessionContext` (plan) a parser reportu (`runReport.ts`)
  se **nemění** — párování reportu ↔ stav drží přesnou shodu množin `title`
  (`runReport.ts:207`), což detail nijak neovlivní.

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

## Run report
---
phase: 43
verdict: done
steps:
  - title: "detail v auto promptu"
    status: done
  - title: "detail v do promptu"
    status: done
  - title: "detail v measure.stepsText"
    status: done
  - title: "Aktualizovat snapshoty + zelená brána"
    status: done
---

# Fáze 43 — report z do session

## Co se udělalo

Dotažen split z fáze 42: `Step.detail` se teď vykresluje v promptech a počítá
do měření tokenů.

- **auto prompt** (`src/prompts/autoPhase.ts`, `stepsBlock`): když má krok
  `detail`, vypíše se na samostatném odsazeném řádku (4 mezery) pod
  `- [stav] title`. Krok bez detailu beze změny.
- **do prompt** (`src/prompts/doPhase.ts`, `stepsBlock`): stejný formát; marker
  `← pracuj na tomhle` zůstává na řádku s title, detail jde na řádek pod ním.
- **měření** (`src/tokens/measure.ts`, `stepsText`): zahrnuje detail stejným
  formátem, takže cena bloku „kroky" odpovídá reálnému promptu.
- `sampleSteps` ve vzorovém YAML reportu zůstal **jen na title** — jádro úspory
  (krátké tituly se klonují do reportu, dlouhý detail je v kontextu jednou).

## Testy

- Nové unit testy s detailem: `autoPhase.test.ts` (krok s detailem + krok bez,
  ověřeno že detail se nepropíše do sampleSteps), `doPhase.test.ts` (detail +
  focusedStep s detailem, marker nekoliduje), `measure.test.ts` (blok „kroky"
  naroste, když krok dostane detail).
- Snapshoty: přibyly jen pro nové testy; existující snapshoty (fixtury bez
  detailu) se nehnuly → potvrzuje, že krok bez detailu = beze změny.
- Brána zelená: `npm test` (455 passed / 36 souborů), `npm run typecheck`
  (rc 0), `npm run build` (rc 0).

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
