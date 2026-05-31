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
