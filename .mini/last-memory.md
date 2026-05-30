# Fáze 38 — Žebříček příkazů podle tokenů

**Cíl:** Vytvořit skript scripts/measure-prompt-tokens.ts, který pro každý mini příkaz (next, discuss, plan, do, auto, done, writeMemory) sestaví jeho prompt s reprezentativním kontextem, odhadne počet tokenů offline heuristikou (bez nových závislostí, např. délka/4) a vypíše příkazy seřazené od nejdražšího po nejlevnější se stručným zdůvodněním, co prompt nejvíc nafukuje; výsledek navíc zapíše do verzovatelného reportu (.mini/token-report.md). Fáze nic v promptech nemění, jen měří a řadí.

## Kroky
- [hotovo] Měřicí jádro src/tokens/measure.ts: estimateTokens(t)=Math.ceil(t.length/4); registr 7 příkazů (next, discuss, plan, do, auto, done, writeMemory) → každý sestaví prompt ze zadaných vstupů přes svůj reálný builder (buildNextSessionPrompt, buildDiscussPhasePrompt, buildPlanSessionPrompt, buildDoPhasePrompt, buildAutoPhasePrompt, buildDoneSessionPrompt, buildWriteMemoryPrompt) a vrátí i pojmenované vkládané bloky (projectMd, historie fází, last-memory, diskuzní poznámky, run report, kroky) jako samostatné stringy. Ověřitelné: npm run typecheck zelený, exporty hotové.
- [hotovo] Žebříček + rozpad proč: measureCommand spočítá reálný prompt, minimální (prázdné vstupy = fixní šablona), rozdíl (= vkládaný kontext) a podíl jednotlivých bloků; rankMeasurements seřadí sestupně podle reálných tokenů. Ověřitelné: unit test — pořadí je sestupné a součet tokenů bloků odpovídá vkládanému kontextu (s tolerancí).
- [hotovo] Render reportu a konzole: renderReportMarkdown (tabulka příkaz | reálný | minimální | rozdíl + u každého 1-2 věty s top bloky a jejich %) a renderConsole. Ověřitelné: snapshot test markdownu nad fixními vstupy.
- [hotovo] Runner scripts/measure-prompt-tokens.ts + npm skript: načte reálné vstupy z cwd přes store.ts/discussNotes.ts/runReport.ts (reprezentativní = aktuální fáze, chybějící artefakty graceful prázdno), zavolá jádro, vypíše žebříček na stdout a zapíše .mini/token-report.md; přidá measure-tokens: tsx scripts/measure-prompt-tokens.ts do package.json. Ověřitelné: npm run measure-tokens proběhne a vznikne .mini/token-report.md se 7 řádky seřazenými sestupně podle reálných tokenů.
- [hotovo] Vitest test src/tokens/measure.test.ts + zelená brána: heuristika (délka/4), sestupné pořadí a snapshot renderu nad FIXNÍMI vstupy (ne reálný stav repa). Ověřitelné: npm test, npm run typecheck, npm run build zelené.

## Auto-commit
- Fáze 38: Žebříček příkazů podle tokenů (`cdd73ffc2f1e54d9883777727a8ed8014ecdb224`)

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

## Nález pro další fázi (co zmenšit)

- **auto/plan/do** táhnou nahoru **diskuzní poznámky (~57 %)** a **seznam kroků
  (~32 %)** vkládané do promptu.
- **next** je drahý kvůli celé vložené **last-memory.md (63 %)** a rostoucí
  **historii všech fází (34 %)** — první kandidát na zeštíhlení (zkrácení/limit).
- `discuss`/`writeMemory` jedou hlavně na **krocích (74 %)**.
- Žádný prompt nevkládá `graph.json` (jen instruuje Claude, ať si ho přečte),
  proto se v rozpadu „proč" neobjevuje — což je správně.
