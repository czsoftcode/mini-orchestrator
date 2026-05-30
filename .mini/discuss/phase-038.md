# Fáze 38 — Žebříček příkazů podle tokenů

## Záměr
Změřit token cenu promptů, které mini příkazy reálně posílají do Claude, seřadit
příkazy od nejdražšího po nejlevnější a u každého stručně vysvětlit, co cenu žene.
Slouží jako podklad pro NÁSLEDUJÍCÍ fázi, kde se rozhodne, co v promptech zmenšit.
Tahle fáze nic v promptech nemění — jen měří, řadí a reportuje.

Příkazy v rozsahu: next, discuss, plan, do, auto, done, writeMemory.
Mimo rozsah: audit, import-gsd.

## Klíčová rozhodnutí
- **Měření tokenů:** offline heuristika (délka textu / 4), bez nových závislostí.
  Jde o relativní žebříček, ne o přesná čísla Claude tokenizéru.
- **Dvojí měření kontextu (klíčové):** každý prompt změřit DVAKRÁT —
  (a) s reálným stavem tohoto repa (skutečné fáze z `.mini`, `graph.json`,
  reálné diskuzní poznámky / run report tam, kde je příkaz používá),
  (b) s minimálním/prázdným kontextem (žádné fáze, prázdný projectMd, žádné notes).
  Rozdíl (reálný − minimální) = cena vkládaného kontextu; minimální = cena fixní
  šablony promptu. To je odpověď na „proč je drahý".
- **Výstup:** 1) výpis do konzole seřazený od nejdražšího; 2) report do
  `.mini/token-report.md` = seřazená tabulka (příkaz | reálný | minimální |
  rozdíl = vkládaný kontext) + u každého řádku 1–2 věty „proč" (hlavní žrouti,
  např. graf X %, historie fází Y %, last-memory Z %).
- **Umístění:** `scripts/measure-prompt-tokens.ts`, zařadit do `package.json`
  scripts (např. `measure-tokens`).
- **Ověření / test:** skript dobíhá a vyprodukuje report; navíc snapshot/unit
  test (vitest) na deterministické heuristice a pořadí. Test běží nad FIXNÍMI/
  minimálními vstupy, NE nad reálným stavem repa (ten se mění každou fází →
  křehký snapshot). typecheck + build + test zelené.

## Pozor na
- **Dvě rodiny promptů — měř tu správnou.** Session prompty
  (`src/prompts/sessionContext.ts`: `buildNextSessionPrompt`,
  `buildPlanSessionPrompt`, `buildDoneSessionPrompt`) používají `/mini:` slash
  commandy přes `mini context <cmd>`. Spawn/headless prompty
  (`buildDoPhasePrompt`, `buildAutoPhasePrompt`, `buildDiscussPhasePrompt`,
  `buildWriteMemoryPrompt`) se posílají přímo. Skript musí pro každý příkaz
  použít builder, který se v provozu SKUTEČNĚ volá — ideálně přes stejné napojení
  jako produkční kód (CONTEXT_COMMANDS v `src/commands/context.ts`, resp.
  `do.ts` / `auto.ts`). Pozn.: pro `next` existuje i headless `buildNextPhasePrompt`,
  ale provoz jede `buildNextSessionPrompt` — měř session.
- **„Reálný" kontext potřebuje vstupy.** Buildery chtějí `projectMd`, `Phase`,
  případně diskuzní poznámky / run report. Načítat je přes existující funkce
  (`src/state/store.ts`, `src/state/discussNotes.ts`, `src/state/runReport.ts`),
  ne ručním parsováním. Pro fáze bez poznámek / run reportu zvolit reprezentativní
  existující fázi nebo gracefully prázdno — skript nesmí spadnout, když artefakt
  chybí.
- **„Minimální" kontext** = prázdný projectMd, žádné fáze/kroky, žádné notes/memory.
  Tím se izoluje cena samotné šablony promptu.
- **Rozpad „proč" (procenta žroutů)** musí vycházet z reálně vkládaných bloků
  (graf, historie fází, last-memory, diskuzní poznámky, run report), ne z odhadu —
  jinak report neposlouží další fázi k rozhodování.
- V plan kroku ujasnit přesné napojení každého příkazu na jeho builder a vstupy.
