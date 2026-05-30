---
phase: 60
verdict: done
steps:
  - title: "Sdílený helper phaseStem + refactor phaseFileName"
    status: done
  - title: "Použít helper v discuss/run cestách"
    status: done
  - title: "Memory: padded název + historie bez data"
    status: done
  - title: "Migrace existujících souborů"
    status: done
  - title: "Přegenerovat snapshoty a zelený build"
    status: done
---

# Fáze 60 — report z auto session

Cíl splněn: názvy souborů ve `discuss/`, `memory/`, `run/` jsou sjednocené se
standardem `phases/` (`phase-XXX`, 3 číslice s nulami) jak v kódu, tak u
existujících souborů.

## Co se udělalo

1. **Sdílený helper `phaseStem(id)`** (`src/state/store.ts`) — `phase-<padStart(3,'0')>`.
   `phaseFileName` je nad ním (`${phaseStem(id)}.json`). Padding nikdy neořezává →
   fáze ≥ 1000 dostane přirozeně delší stem. Unit testy v `store.test.ts`
   (vč. `phaseStem(1000) → phase-1000`).
2. **Přepojeny všechny konstrukce cest** na `phaseStem`: `state/discussNotes.ts`,
   `state/runReport.ts` (vč. `.prev.md`), `commands/discuss.ts`, `commands/auto.ts`,
   `prompts/discussPhase.ts`, `prompts/autoPhase.ts`, `prompts/sessionContext.ts`.
   Sjednoceny i doc-komentáře.
3. **Memory bez data, ale s historií** (`commands/writeMemory.ts`): výchozí název
   `phase-XXX.md`; při kolizi (opakované `done`) nová funkce `freeMemoryFileName`
   přidá `-2`, `-3`, … Funkce `fsSafeTimestamp` smazána (stala se mrtvým kódem).
4. **Migrace existujících souborů**: hromadné přejmenování (git mv pro trackované,
   mv pro netrackované) — 28 souborů v `discuss/`, 47 v `run/`, 46 v `memory/`
   (z memory zahozen ISO timestamp), vč. dříve netrackovaného `phase-59-…md`.
   Bezkolizní (ověřeno: 1 memory soubor na ID).
5. **Build + testy zelené**: `tsc` OK, `vitest` 576/576 pass. Přegenerovány
   snapshoty promptů a token-measure (drobný posun: `phase-9.prev.md` →
   `phase-009.prev.md`). Opraveny testy s natvrdo zapsanými starými cestami
   (`autoPhase.test.ts`, `context.test.ts`, `auto.e2e.test.ts` fake claude binárka).

## Poznámky

- Tahle session si report logicky zapsala rovnou do `phase-060.md` (nová
  konvence), ne do `phase-60.md` z původního promptu — `done` ho přes
  `runReportPath` hledá pod paddovaným názvem.
- `previousReportPath` vstupy v `autoPhase.test.ts` (`phase-5.prev.md` apod.)
  zůstaly nepaddované — jsou to libovolné testovací vstupy předané builderu,
  ne cesty konstruované `phaseStem`, takže na realitu nemají vliv.
