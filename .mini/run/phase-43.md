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
