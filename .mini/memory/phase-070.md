# Fáze 70 — Done commitne všechny změny

**Cíl:** Upravit finalizaci mini done tak, aby do commitu fáze spadl i memory záznam, přegenerovaný graf a finální stav (status done + currentPhaseId), takže po done nezůstanou viset žádné nezacommitované změny do další fáze.

## Kroky
- [hotovo] PhaseAutoCommit.sha volitelné
- [hotovo] Reorder finalizace v done.ts
- [hotovo] undo přes preSha
- [hotovo] Memory bez vlastního sha
- [hotovo] Testy a build
- [hotovo] CHANGELOG

## Auto-commit
- Fáze 70: Done commitne všechny změny

## Diskuse
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

## Run report
---
phase: 70
verdict: done
steps:
  - title: "PhaseAutoCommit.sha volitelné"
    status: done
  - title: "Reorder finalizace v done.ts"
    status: done
  - title: "undo přes preSha"
    status: done
  - title: "Memory bez vlastního sha"
    status: done
  - title: "Testy a build"
    status: done
  - title: "CHANGELOG"
    status: done
---

# Fáze 70 — report z auto session

## Co se udělalo
`mini done` teď commitne celou fázi v **jednom** commitu a po `done` ve worktree
nic nevisí do další fáze.

- **`src/state/types.ts`** — `PhaseAutoCommit.sha` je nově **volitelné**. Commit fáze
  obsahuje i `state.json` se záznamem, takže do něj nelze uložit jeho vlastní výsledný
  sha (závisel by sám na sobě). Identitu commitu držíme přes `preSha`. Legacy fáze sha
  v `state.json` mají dál (zpětná kompat).
- **`src/commands/done.ts`** — `finalizePhaseSideEffects` přeskládán: předběžně nastaví
  `phase.autoCommit = { preSha, subject }` (preSha = aktuální HEAD), pak zapíše memory,
  přegeneruje graf, **uloží `state.json`** (posun na `done`) a teprve **nakonec** udělá
  jediný `git add -A && commit`. `commitPhaseWork` už sha neukládá; když commit
  neproběhne (není repo / žádné změny / selhání), předběžný `autoCommit` zase zruší.
- **`src/git.ts`** — nový `headParentSha` (`git rev-parse HEAD^`) pro guard v undo.
- **`src/commands/undo.ts`** — identita commitu fáze přes `HEAD^ === preSha` místo
  `HEAD === sha`; `findRevertedAutoCommit` porovnává `preSha`. Funguje i pro legacy
  entries (mají preSha taky).
- **`src/commands/writeMemory.ts`** — sekce `## Auto-commit` tiskne sha jen když je
  (legacy); u nového tvaru ukáže jen subject.
- **Testy** — `done.test.ts` (autoCommit bez sha; nový test: memory se zapíše PŘED
  commitem), `undo.test.ts` (mock + logika přes `headParentSha`/`preSha`),
  `writeMemory.test.ts` (nový test: auto-commit bez sha → jen subject). `npm test`:
  **650 zelených**, build OK.
- **CHANGELOG.md** — záznam do `## [Unreleased]` (Changed).

## Na co dát pozor
- **Claude-path memory** (opt-in přes `mini model`, scope `memory`) má v promptu hint
  „spusť `git show HEAD`" — při novém pořadí commit ještě neproběhl, takže by ukázal
  předchozí commit. Default (TS) cesta memory tím netrpí (staví z dat fáze). Bráno mimo
  rozsah této fáze — opravit, až se ta cesta bude reálně používat.
- **Globální `mini` neukazuje na lokální build** — pouštět přes `node dist/cli.js …`.

## Ověření
- Strojově ověřeno testy + buildem (650 testů). Cíl „po `done` nic nevisí" je navíc
  ověřitelný **živě** finalizací této fáze (po `mini done` zkontrolovat `git status` —
  má být čistý).

## Otevřené konce
- Žádné kromě poznámky o Claude-path memory výše.
