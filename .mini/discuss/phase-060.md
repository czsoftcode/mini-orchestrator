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
