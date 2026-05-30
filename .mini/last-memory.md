# Fáze 41 — Projekt blok read-once v do

**Cíl:** buildAutoPhasePrompt dostane opt-in příznak useProjectRef (default vypnuto); /mini:do místo inlinování project.md vykreslí relativní odkaz .mini/project.md + read-once instrukci (auto zůstává inline). Ověřitelné aktualizovanými snapshot/unit testy a přegenerovaným token-reportem.

## Kroky
- [hotovo] Builder buildAutoPhasePrompt: přidat opt-in příznak useProjectRef?: boolean (default vypnuto) do AutoPhaseContext; projekt vytáhnout z inline return (autoPhase.ts:109-110) do proměnné projectBlock — když true, vykreslit pod nadpisem '# Projekt' relativní odkaz .mini/project.md + read-once instrukci (zrcadlit notesBlock); když false/neuvedeno → dnešní inline větev beze změny. Ověřitelné: npm run typecheck zelený, funkce přijímá nový příznak.
- [hotovo] Unit testy builderu v autoPhase.test.ts: nové testy pro useProjectRef: true (výstup obsahuje .mini/project.md + read-once formulaci a NEobsahuje inline text projektu); při vypnutém příznaku se výstup nemění. Ověřitelné: npm test zelené, existující snapshoty autoPhase.test.ts.snap beze změny.
- [hotovo] context.ts (větev do) přepnout na referenci + test v context.test.ts: do větev (:124-132) nastaví useProjectRef: true. Nový test: /mini:do → výstup má odkaz .mini/project.md + read-once, ne inline projekt. Ověřitelné: npm test zelené, nový context test.
- [hotovo] measure.ts doSpec → reference mód: z blocks() u do vyhodit blok projekt, build přepnout na useProjectRef: true, doplnit poznámku že Read call se nepočítá. Brána + přegenerování: npm run typecheck, npm run build, npm test zelené a npm run measure-tokens přegeneruje .mini/token-report.md (bez tvrdé prahové hodnoty). Ověřitelné: brána zelená, report přegenerován.

## Auto-commit
- Fáze 41: Projekt blok read-once v do (`133b1e4b5f9dc03458e1041e80b899b79e70373b`)

## Pozor na
- Default `useProjectRef` **vypnutý** → výstup `auto` i existující snapshoty
  `autoPhase.test.ts.snap` se NESMÍ změnit.
- Nové testy: `autoPhase.test.ts` pro `useProjectRef: true` (obsahuje
  `.mini/project.md` + read-once, NEobsahuje inline text projektu; vypnutý
  příznak beze změny). `context.test.ts`: `do` větev → odkaz, ne inline projekt.
- Brána zelená: `npm run typecheck`, `npm run build`, `npm test`,
  `npm run measure-tokens` přegeneruje `.mini/token-report.md`.
- Headless `mini do` (`buildDoPhasePrompt`) a `auto` se NEMĚNÍ — jen slash `do`.
