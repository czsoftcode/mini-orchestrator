---
phase: 22
verdict: done
steps:
  - title: "Sepsat nálezy ke správnosti workflow (osiřelá doing)"
    status: done
  - title: "Sepsat nálezy k mrtvému kódu a úklidu"
    status: done
  - title: "Sepsat nálezy k robustnosti a chybovým stavům"
    status: done
  - title: "Sepsat nálezy k DX a výstupu CLI"
    status: done
  - title: "Sloučit nálezy do .mini/improvements.md s prioritou/odhadem"
    status: done
  - title: "Ověřit idempotenci a akčnost položek backlogu"
    status: done
verify:
  - title: "Schválit prioritizaci a odhady položek v .mini/improvements.md"
    detail: "Priority H/M/L a odhady (malá/střední/velká) jsou můj návrh. Faktické tvrzení o kódu jsem ověřil čtením zdrojáků, ale váhu jednotlivých položek a pořadí, v jakém je chceš řešit, posuď sám."
  - title: "Rozhodnout, které položky chceš rovnou poslat do mini next"
    detail: "Každá položka má title+goal připravené pro mini next. Akčnost jsem ověřil formulačně (žádné vágní „zlepšit kvalitu“), ale výběr a načasování je na tobě."
  - title: "Posoudit záměr u W3 (auto + verify bez TTY)"
    detail: "Že se v auto módu volá ask() i u verify, je doložené v kódu (done.ts:431). Že se bez TTY verify tiše vyhodnotí jako pass, je má dedukce z chování knihovny prompts — nereprodukoval jsem to v neinteraktivním prostředí. Stojí za reálné ověření."
---

# Fáze 22 — report z auto session

Fáze byla **čistě analytická** — nic se neimplementovalo. Výstupem je nový
checked-in dokument `.mini/improvements.md`: prioritizovaný backlog 14 položek
napříč čtyřmi oblastmi, každá s `title` + `goal` připravenými pro `mini next`.

## Co se ověřilo strojově (čtením kódu / spuštěním)

- **Baseline zelený:** `npm test` → 286 testů / 24 souborů prošlo,
  `tsc --noEmit` čistý. Zapsáno do dokumentu jako referenční stav.
- **W1 — osiřelá `doing`:** potvrzeno. `advanceToNextPhase` (`done.ts:282`)
  bere jen `proposed/planned`; rodič po `block`→podfáze zůstává `doing`
  (nastaveno v `do.ts:116`) a nikdy se nedozavře.
- **W2 — desetinné ID:** potvrzeno. `commitPhase` (`next.ts:181`) počítá
  `Math.max(0, ...ids) + 1`; s existující podfází `21.1` vyjde nová fáze `22.1`.
- **R1 — `do --max-turns` no-op:** potvrzeno. `cli.ts:48-51` parsuje volbu, ale
  handler volá `doPhase({ stream })` bez `maxTurns`, ač `doPhase` ho umí použít.
- **C1 — „mrtvý kód" z fáze 17 NENÍ mrtvý:** potvrzeno. `MEMORY_ALLOWED_TOOLS`,
  `MEMORY_TIMEOUT_MS` i `buildWriteMemoryPrompt` dál používá `writeViaClaude`
  (`commands/writeMemory.ts`). Skip toho kroku ve fázi 17 byl tedy správný —
  zapsal jsem to jako položku „zrušit zavádějící očekávání", ne jako mazání.

## Idempotence

`.mini/improvements.md` při tomto běhu neexistoval → vytvořen čistě. Dokument
má hlavičku „Jak s tímhle souborem pracovat" a sekci „Hotovo“, aby se při
re-runu fáze 22 nepřipisovaly duplicity, ale škrtalo/přesouvalo.

## Pokrytí oblastí

- **Workflow:** W1–W4 (osiřelá doing, desetinné ID, auto+verify bez TTY,
  re-run verify).
- **Úklid:** C1–C3 (živý „mrtvý" kód, deprecated `state.model`, široký
  `PermissionMode`).
- **Robustnost:** R1–R4 (max-turns no-op, chybějící e2e, ENOENT claude, retry
  v next).
- **DX:** D1–D4 (status bez výsledku auto session, zavádějící help auto,
  help max-turns, čitelnost streamu).

## Otevřené otázky pro člověka

Viz `verify` výše — hlavně schválení priorit/odhadů a výběr, co poputuje do
`mini next`. Nejsilnější kandidáti na hned další fázi jsou podle mě **W1**
(reálný workflow bug) a **R1** + **W2** (drobné, ale tiché chyby s malým
odhadem).
