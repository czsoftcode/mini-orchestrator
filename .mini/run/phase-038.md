---
phase: 38
verdict: done
steps:
  - title: "Měřicí jádro src/tokens/measure.ts: estimateTokens(t)=Math.ceil(t.length/4); registr 7 příkazů (next, discuss, plan, do, auto, done, writeMemory) → každý sestaví prompt ze zadaných vstupů přes svůj reálný builder (buildNextSessionPrompt, buildDiscussPhasePrompt, buildPlanSessionPrompt, buildDoPhasePrompt, buildAutoPhasePrompt, buildDoneSessionPrompt, buildWriteMemoryPrompt) a vrátí i pojmenované vkládané bloky (projectMd, historie fází, last-memory, diskuzní poznámky, run report, kroky) jako samostatné stringy. Ověřitelné: npm run typecheck zelený, exporty hotové."
    status: done
  - title: "Žebříček + rozpad proč: measureCommand spočítá reálný prompt, minimální (prázdné vstupy = fixní šablona), rozdíl (= vkládaný kontext) a podíl jednotlivých bloků; rankMeasurements seřadí sestupně podle reálných tokenů. Ověřitelné: unit test — pořadí je sestupné a součet tokenů bloků odpovídá vkládanému kontextu (s tolerancí)."
    status: done
  - title: "Render reportu a konzole: renderReportMarkdown (tabulka příkaz | reálný | minimální | rozdíl + u každého 1-2 věty s top bloky a jejich %) a renderConsole. Ověřitelné: snapshot test markdownu nad fixními vstupy."
    status: done
  - title: "Runner scripts/measure-prompt-tokens.ts + npm skript: načte reálné vstupy z cwd přes store.ts/discussNotes.ts/runReport.ts (reprezentativní = aktuální fáze, chybějící artefakty graceful prázdno), zavolá jádro, vypíše žebříček na stdout a zapíše .mini/token-report.md; přidá measure-tokens: tsx scripts/measure-prompt-tokens.ts do package.json. Ověřitelné: npm run measure-tokens proběhne a vznikne .mini/token-report.md se 7 řádky seřazenými sestupně podle reálných tokenů."
    status: done
  - title: "Vitest test src/tokens/measure.test.ts + zelená brána: heuristika (délka/4), sestupné pořadí a snapshot renderu nad FIXNÍMI vstupy (ne reálný stav repa). Ověřitelné: npm test, npm run typecheck, npm run build zelené."
    status: done
---

# Fáze 38 — report z auto session

Cíl splněn: vznikl nástroj, který změří token cenu promptů mini příkazů, seřadí
je od nejdražšího a u každého ukáže, co cenu žene. Nic v promptech se neměnilo —
jen měření, řazení a report. Slouží jako podklad pro NÁSLEDUJÍCÍ fázi (co zmenšit).

## Co se udělalo

- **`src/tokens/measure.ts`** — čisté, typované jádro (žádné IO):
  - `estimateTokens(t) = Math.ceil(t.length / 4)` (offline heuristika, bez závislostí).
  - Pro každý ze 7 příkazů spec s reálným builderem + pojmenovanými vkládanými bloky.
  - `measureAll(RealInputs)` → `realTokens`, `injectedTokens` (= součet obsahových
    bloků), `templateTokens` (= reálný − vkládaný, clamp ≥ 0) a rozpad na bloky
    (projekt, historie fází, last-memory, diskuzní poznámky, run report, kroky, …).
  - `rankMeasurements` (sestupně dle reálných tokenů), `renderReportMarkdown`
    (čistá, bez časové značky → snapshotovatelná), `renderConsole`.
- **`src/tokens/measure.test.ts`** — vitest nad FIXNÍMI vstupy (ne reálný stav
  repa): heuristika, 7 příkazů, determinismus, `injected = Σ bloky`,
  `reálný = šablona + vkládaný` (oba ≥ 0), sestupné pořadí, snapshot markdownu i konzole.
- **`scripts/measure-prompt-tokens.ts`** — tenký runner (běží přes `tsx`,
  nepotřebuje build): z `.mini` načte reálné vstupy (projectMd, historii fází,
  reprezentativní = aktuální/poslední fázi, její diskuzní poznámky, last-memory,
  run report) přes existující loadery (`store.ts`, `discussNotes.ts`,
  `runReport.ts`), graceful u chybějících artefaktů; vytiskne žebříček a zapíše
  `.mini/token-report.md`.
- **`package.json`** — přidán skript `measure-tokens: tsx scripts/measure-prompt-tokens.ts`.

## Klíčové rozhodnutí (oproti původnímu cíli)

- **Vkládaný kontext = součet změřených obsahových bloků** (ne `reálný − prázdný
  build`). Důvod: `done` má větvenou šablonu (verify / bez verify), takže rozdíl
  dvou různě větvených promptů cenu kontextu zkresloval — první běh dal `done`
  nesmyslných `8 tok` / `1613 %`. Součet bloků je odolný a procenta v rozpadu
  dávají 100 %. Tabulka tak má sloupce Reálný | Šablona | Vkládaný kontext.
- Logika je v `src/tokens/measure.ts` (kvůli typecheck + vitestu), runner je tenký.

## Ověření (strojově)

- `npm run typecheck` ✓, `npm run build` ✓, `npm test` ✓ — 36 souborů, 433 testů
  (z toho 8 nových v `measure.test.ts`).
- `npm run measure-tokens` ✓ — `.mini/token-report.md` má 7 řádků seřazených
  sestupně podle reálných tokenů. Žebříček nad aktuálním repem:
  auto (2738) > plan (1676) > do (1591) > next (1583) > discuss (1051) >
  writeMemory (971) > done (268).

## Nález pro další fázi (co zmenšit)

- **auto/plan/do** táhnou nahoru **diskuzní poznámky (~57 %)** a **seznam kroků
  (~32 %)** vkládané do promptu.
- **next** je drahý kvůli celé vložené **last-memory.md (63 %)** a rostoucí
  **historii všech fází (34 %)** — první kandidát na zeštíhlení (zkrácení/limit).
- `discuss`/`writeMemory` jedou hlavně na **krocích (74 %)**.
- Žádný prompt nevkládá `graph.json` (jen instruuje Claude, ať si ho přečte),
  proto se v rozpadu „proč" neobjevuje — což je správně.

## Poznámky

- `do` měří `buildDoPhasePrompt` (CLI `mini do`), `auto` měří `buildAutoPhasePrompt`
  (= i to, co používá `mini context do` / `/mini:do`) — obě odlišné šablony pokryté.
- `next` se měří bez `userHint` (vstup uživatele, ne kontext repa).
- Pozn. k prostředí: harness během session měl velké zpoždění a vracel výstupy
  tool callů opožděně/dávkově (chvíli to vypadalo jako výpadek). Finální brána
  i `measure-tokens` byly nakonec ověřeny z reálných běhů.
