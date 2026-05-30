---
phase: 12
verdict: done
steps:
  - title: "Helper v git.ts pro HEAD SHA a subject"
    status: done
  - title: "Helper pro detekci čistého pracovního stromu"
    status: done
  - title: "Helper pro soft reset na předchozí commit"
    status: done
  - title: "Uložit pre-commit HEAD do state před auto-commitem"
    status: done
  - title: "Undo detekuje auto-commit a nabídne revert"
    status: done
  - title: "Při neshodě jen vrátit state a vypsat hint"
    status: done
  - title: "Testy pro nové git helpery a undo větve"
    status: done
---

# Fáze 12 — report z auto session

## Co se povedlo

- **`src/git.ts`** — přidány helpery `headSha`, `headSubject`, `isCleanWorkingTree`, `softResetTo`. Všechny respektují stejnou konvenci jako zbytek modulu (nehází, vrací `null` / `GitResult` při chybě).
- **`src/state/types.ts`** — nový typ `PhaseAutoCommit` (`preSha` / `sha` / `subject`) a volitelné pole `autoCommit?` na `Phase`. Pre-commit HEAD si tím pamatujeme přímo ve state.json.
- **`src/commands/done.ts`** — `commitPhaseWork` teď před commitem získá `preSha`, po úspěšném commitu post-commit `sha` a oba spolu se subjectem zapíše do `phase.autoCommit`. Ve všech třech místech volání (`collectNotesAndSave`, `applyAutoReport`, `finalizePhase`) jsem prohodil pořadí `save`/`commit` — commit přijde PŘED `save`, takže `autoCommit` info skončí ve stejném save jako finalize stavu fáze (a `state.prev.json` zůstane „pre-finalize", tj. bez `autoCommit`).
- **`src/commands/undo.ts`** — kompletní přepis s detekcí auto-commitu. `findRevertedAutoCommit` najde fázi, která v `current` má `autoCommit` a v `prev` ne (nebo má jiný `sha`). `classifyRevert` ověří, že HEAD pořád sedí a strom je čistý — pokud ano, undo udělá `git reset --soft preSha`; pokud HEAD utekl / strom je špinavý / nejsme v repu, undo vrátí jen state a vypíše hint, jak commit zrušit ručně. Tím pokrývá oba „step" body 5 i 6.
- **Testy** — `src/git.test.ts` rozšířen o testy pro `headSha`, `headSubject`, `isCleanWorkingTree` a `softResetTo` (včetně edge case s neexistujícím SHA a ne-git adresářem). Nový `src/commands/undo.test.ts` s 9 scénáři pro všechny větve (žádný auto-commit, match, mismatch z HEAD/dirty tree/ne-git, soft reset selže, uživatel zamítne). `src/commands/done.test.ts` má dva nové testy ověřující, že `phase.autoCommit` se zapíše do state po úspěšném commitu a NEZAPÍŠE při neúspěchu. Mock git modulu v `done.test.ts` i `auto.test.ts` rozšířen o nové helpery, aby existující testy dál procházely.
- **README** — řádek o `mini undo` v tabulce příkazů + nová FAQ sekce „Undo po auto-commitu?".

## Co jsem ověřil

- `npm run typecheck` — projde čistě.
- `npx vitest run src/git.test.ts src/commands/undo.test.ts src/commands/done.test.ts src/commands/auto.test.ts` — 67/67 passed.
- Celé `npm test` projde s výjimkou 4 preexisting snapshot fails v `src/prompts/discussPhase.test.ts` (snapshoty zapomenuté regenerovat z fáze 8, netýká se fáze 12).

## Poznámky pro člověka

- `git reset --soft` (ne `--mixed`) je záměr — změny zůstanou v indexu jako staged, uživatel je může commitnout znovu / upravit. Pokud bys preferoval mixed, je to jeden řádek v `softResetTo`.
- Pre-commit HEAD ukládám až **po** úspěšném `commitAll` (mám oba SHA — pre i post — a uložím je jen pokud commit prošel). Důsledek: pokud commit selže (např. pre-commit hook), `phase.autoCommit` zůstane prázdné a undo se chová jako dřív.
- Mimo scope, ale stojí za zmínku: zastaralé snapshoty v `src/prompts/discussPhase.test.ts` by chtělo regenerovat (`npx vitest -u src/prompts/discussPhase.test.ts`). Nedělal jsem to, abych nemíchal do reportu fáze 12 změny mimo zadání.
