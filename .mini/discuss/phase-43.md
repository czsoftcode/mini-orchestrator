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
