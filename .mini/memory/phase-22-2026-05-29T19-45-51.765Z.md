# Fáze 22 — Návrh na vylepšení mini orchestrátoru

**Cíl:** Sepiš, neimplementuj co by se dalo vylepšit v programu

## Kroky
- [hotovo] Sepsat nálezy ke správnosti workflow (osiřelá doing)
- [hotovo] Sepsat nálezy k mrtvému kódu a úklidu
- [hotovo] Sepsat nálezy k robustnosti a chybovým stavům
- [hotovo] Sepsat nálezy k DX a výstupu CLI
- [hotovo] Sloučit nálezy do .mini/improvements.md s prioritou/odhadem
- [hotovo] Ověřit idempotenci a akčnost položek backlogu

## Auto-commit
- Fáze 22: Návrh na vylepšení mini orchestrátoru (`6924c30dd8e83d0119ee8b1fbdfb233f1aa402fc`)

## Diskuse
# Fáze 22 — Návrh na vylepšení mini orchestrátoru

## Záměr

Fáze je **čistě analytická — nic se neimplementuje.** Cílem je projít vyzrálý
projekt (po 21 fázích) a sepsat strukturovaný **backlog návrhů na vylepšení**
napříč čtyřmi oblastmi: správnost workflow, úklid/mrtvý kód, robustnost a
chybové stavy, DX a výstup CLI.

Backlog slouží jako zásobník budoucích fází — jednotlivé položky se mají dát
přímo předat do `mini next` jako další fáze.

## Klíčová rozhodnutí

- **Výstup = jeden dokument `.mini/improvements.md`** (verzovaný markdown v repu,
  checked-in). Přežije fázi, dá se k němu vracet a škrtat hotové položky.
- **Žádná implementace** v této fázi. `mini plan` má rozseknout fázi na kroky
  typu „projdi oblast X a sepiš nálezy", ne „naprogramuj X".
- **Formát každé položky backlogu:**
  - priorita (H / M / L)
  - odhad pracnosti (malá / střední / velká fáze)
  - oblast / kategorie (workflow / úklid / robustnost / DX)
  - návrh `title` + `goal` ve formátu, který jde rovnou předat do `mini next`
- **Pokryté oblasti (všechny čtyři):** správnost workflow, úklid/mrtvý kód,
  robustnost a chybové stavy, DX a výstup CLI.

### Konkrétní kandidáti, které z analýzy nesmí vypadnout

(Vyplynuly už z grafu a paměti — slouží jako záchytné body, ne jako úplný seznam.)

- **Osiřelá `doing` fáze** — po `block` verify vznikne opravná podfáze, ale
  rodičovská fáze zůstane navždy ve stavu `doing` a `advanceToNextPhase` ji
  přeskočí. Nikdy se nedozavře. (Explicitní loose end z fáze 21.)
- **Mrtvý kód** — krok z fáze 17 „smazat `MEMORY_ALLOWED_TOOLS`,
  `MEMORY_TIMEOUT_MS`, import `buildWriteMemoryPrompt`" byl `skipped`. Ověřit
  a najít případný další nepoužívaný povrch.
- **Chybějící e2e/integrační test** — auto smyčka je testovaná jen s mocky,
  reálný průchod Claudem nikdo neověřil.
- **Robustnost** — chování při chybějící `claude` / `git` binárce, při selhání
  parsování run reportu, kvalita fallbacků.
- **DX** — chybové hlášky, help texty, doladění `mini status`, čitelnost streamu.

## Pozor na

- **Prompt pro `do` musí cílit na analýzu, ne kód.** Výsledky analýzy Claude
  sám neověří → skoro vše patří do sekce `verify` run reportu (lidský pohled).
  Verdict fáze bude pravděpodobně `done` s plným `verify` seznamem.
- **Nepřekročit záměr** — pokušení rovnou „opravit" osiřelou doing fázi nebo
  smazat mrtvý kód. To NEPATŘÍ do této fáze; jen to zapsat jako položku backlogu.
- **Položky musí být akční** — formulovat title/goal tak, aby šly bez další
  diskuse hodit do `mini next`. Vyhnout se vágním „zlepšit kvalitu".
- **Idempotence dokumentu** — pokud `.mini/improvements.md` už existuje (re-run),
  aktualizovat, ne slepě připisovat duplicity.

## Run report
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
