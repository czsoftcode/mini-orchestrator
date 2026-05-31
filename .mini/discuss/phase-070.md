# Fáze 70 — Done commitne všechny změny

## Záměr
Po `mini done` nesmí ve worktree zůstat viset žádné nezacommitované změny do další fáze.
Dnes commit (`finalizePhaseSideEffects` → `commitPhaseWork`) proběhne PŘED zápisem
memory souboru, regenerací grafu a finálním `save(state)` (done.ts: 169 advance → 172
commit → 174 save). Proto visí `.mini/state.json`, per-fázový `phase-XXX.json`,
`.mini/memory/phase-XXX.md` a regenerovaný `.mini/graph/`. `.gitignore` pro `.mini/`
nic nemá → vážně to visí jako tracked změny.

## Klíčová rozhodnutí
- **Zvolený přístup: jeden commit, reorder, undo přes preSha** (z nabízených 3 variant).
- **Reorder finalizace**: memory, graf, posun stavu (fáze `done` + `currentPhaseId`)
  i `save(state)` proběhnou **PŘED** jedním commitem fáze. `git add -A` pak pobere
  kód, testy, README/CHANGELOG, `state.json`, per-fázový json, memory i graf → strom čistý.
- **Bump verze + stamp changelogu** zůstávají před commitem (jako dnes).
- **Paradox „sha ve vlastním commitu"**: commit nemůže obsahovat soubor (`state.json`),
  který nese svůj vlastní výsledný sha. Proto do commitnutého stavu ukládáme jen
  `preSha` (HEAD před commitem, známé předem) + `subject`, **ne** vlastní `sha`.
  → `PhaseAutoCommit.sha` se stane **volitelným** (legacy fáze ho v `state.json`
  mají, nové už ne).
- **undo se přepne na identitu přes preSha**:
  - `classifyRevert` guard: místo `HEAD === autoCommit.sha` použít `HEAD^ === preSha`
    (commit fáze je pořád vrchní) + čistý pracovní strom; reset cílí na `preSha` (beze změny).
  - `findRevertedAutoCommit` (detekce nového auto-commitu): porovnávat přes `preSha`
    (resp. nově přidaný auto-commit) místo `sha`, aby fungovalo i bez `sha`.
  - Zachovat zpětnou kompatibilitu s legacy entries, co `sha` mají.
- **Memory „## Auto-commit"**: dnes tiskne výsledný sha; ten u nového toku nelze znát
  předem (memory je uvnitř commitu). Místo sha tisknout subject (příp. preSha).

## Pozor na
- `save(state)` se nesmí volat dvakrát — přesunout ho před commit a z původního
  místa (done.ts:174) odstranit/posunout pro `done` větev. Pozor na tři finalizační
  cesty (`applyAutoReport`, `collectNotesAndSave`/`finalizePhase`, řádky ~172/583/815).
- `commitAll` musí stáhnout i untracked memory/graf (`git add -A`) — ověřit.
- Zpětná kompatibilita undo: nejnovější fáze bude nový styl (bez sha), starší mají sha.
  Undo si pamatuje jen krok zpět → reálně řeší jen poslední fázi (nový styl) — ok.
- Testy: `done.test.ts` (pořadí, čistý strom po done, autoCommit bez sha) a
  `undo.test.ts` (guard přes preSha/parent) projít a doplnit.
- `--push` + tag verze: tag se zakládá po pushi z `version` — reorder se ho nedotkne,
  ale ověřit, že push běží až po jediném commitu.
