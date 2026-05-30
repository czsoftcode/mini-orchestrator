# Fáze 60 — Sjednocení názvů souborů fází

**Cíl:** Zavést sdílený helper pro phase-XXX (3 číslice s nulami) a použít ho v discuss/run/memory cestách, z memory názvu odstranit timestamp, přejmenovat existující soubory a opravit testy/snapshoty.

## Kroky
- [hotovo] Sdílený helper phaseStem + refactor phaseFileName
- [hotovo] Použít helper v discuss/run cestách
- [hotovo] Memory: padded název + historie bez data
- [hotovo] Migrace existujících souborů
- [hotovo] Přegenerovat snapshoty a zelený build

## Auto-commit
- Fáze 60: Sjednocení názvů souborů fází (`40ecc6f07e1830e7cd61d01395c0f7955a320460`)

## Diskuse
# Fáze 60 — Sjednocení názvů souborů fází

## Záměr
Sjednotit názvy souborů ve `.mini/discuss/`, `.mini/memory/` a `.mini/run/` na
standard z `.mini/phases/`, tj. `phase-XXX.md` se 3místným paddingem nulami
(jako `phase-060.json`). Z memory názvu odstranit dlouhý ISO timestamp.
Změnit kód (aby nové soubory vznikaly správně) i přejmenovat existující soubory.

## Klíčová rozhodnutí
- **Sdílený helper** pro stem názvu, např. `phaseStem(id)` → `phase-060`
  (3 číslice, `padStart(3, '0')`). Vytáhnout z `store.ts:51` (`phaseFileName`)
  a použít všude, kde se dnes staví `phase-${id}.md` bez nul:
  `state/discussNotes.ts:7`, `commands/discuss.ts:85,89`,
  `commands/writeMemory.ts:63,75,76`, `prompts/autoPhase.ts:60,88`,
  `prompts/sessionContext.ts:165`, `prompts/discussPhase.ts:20`.
  `phaseFileName` zůstane = `${phaseStem(id)}.json`.
- **Memory bez timestampu, ale s historií:** výchozí název `phase-XXX.md`.
  Pokud soubor už existuje (opakované `done` téže fáze), připojit číselný
  rozlišovač `-2`, `-3`, … (NE datum). Běžný případ → čistý `phase-XXX.md`.
  Funkce `fsSafeTimestamp` v `commands/writeMemory.ts` se tím stane mrtvým
  kódem → smazat (žádné jiné použití).
- **discuss/ a run/**: vždy jeden soubor `phase-XXX.md` (přepis OK, tak to je dnes).
- **Migrace existujících souborů**: v rámci `do` hromadně `git mv` všech starých
  souborů na nový formát:
  - `discuss/phase-N.md` → `discuss/phase-0NN.md`
  - `run/phase-N.md` → `run/phase-0NN.md`
  - `memory/phase-N-<timestamp>.md` → `memory/phase-0NN.md`
    (ověřeno: 1 soubor na ID, žádné duplicity → bezkolizní; pozor i na
    netrackovaný `memory/phase-59-2026-05-30T16-08-57.044Z.md` z git status).
- **Snapshoty promptů** obsahují tyhle cesty v textu → přegenerovat.

## Pozor na
- Timestamp v memory je dnes čistě unikátor názvu — `last-memory.md` se odvozuje
  rovnou z právě zapsaného souboru (`writeLastMemorySummary`), nikde se memory
  nečte přes glob/readdir. Odstranění data tedy nic nerozbije; jen je potřeba
  před zápisem spočítat volný název (collision → `-2`/`-3`).
- Doc-komentáře zmiňující `phase-{id}-{datum}.md` / `phase-{id}.md`
  (writeMemory.ts:38,330; autoPhase.ts:16,28,54) sjednotit s novou realitou.
- Všechna dnešní ID < 100, takže 3 číslice stačí; helper ale neořezávat na
  fixní šířku (pro ID ≥ 100 nechat přirozeně delší).
- **Více než 999 fází (>= 1000):** řeší se samo, ale je třeba to pojistit.
  `padStart(3, '0')` jen doplňuje na minimální šířku, nikdy neořezává — fáze
  1000 → `phase-1000.md` (4 číslice), unikátní a správné. Helper proto psát
  výhradně přes `padStart(3, '0')`, NIKDY jako fixní ořez na 3 znaky.
  Pořadí fází se v mini řídí polem `header.phases` ve `state.json`
  (`assembleState`, store.ts:159), NE lexikografickým řazením názvů souborů
  (přechod 999→1000 by `ls` mis-sortil — `"1000" < "999"` — ale mini na string
  sort nikde nespoléhá; nezavádět ho). Přidat unit test: `phaseStem(1000)`
  → `phase-1000`.

## Run report
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
