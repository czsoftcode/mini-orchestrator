---
phase: 45
verdict: done
steps:
  - title: "Modul graphHint.ts s konstantou"
    status: done
  - title: "Vložit hint do next builderů"
    status: done
  - title: "Vložit hint do plan + discuss builderů"
    status: done
  - title: "Snapshoty + zelená brána"
    status: done
verify:
  - title: "Sledovat, zda agent v next/discuss/plan reálně sahá po grafu"
    detail: "Hint je advisory text — strojově ověřeno, že je v promptech (snapshoty), ale jestli se jím Claude v praxi řídí (čte graph.json → mapy → cílené výřezy) se ukáže až za chodu příštích fází. Subjektivní, nejde otestovat."
---

# Fáze 45 — report z auto session

## Co se udělalo
- **Nový `src/prompts/graphHint.ts`** s konstantou `GRAPH_USAGE_HINT` — jeden těsný
  neutrální odstavec: žebříček `.mini/graph.json (pokud existuje) → per-file mapy
  .mini/graph/<cesta>.md → zdrojáky`, u velkých souborů preferovat výřez (symbol
  najít přes Grep tool/ripgrep, přečíst `Read` s `offset`/`limit`), malé klidně
  celé.
- **Vloženo do obou rodin promptů** (next, plan, discuss):
  - `nextPhase.ts` (headless) — nahrazena věta „smíš číst soubory…", `Nezapisuj
    nic.` ponecháno.
  - `sessionContext.ts` `buildNextSessionPrompt` (interaktivní) — nahrazena
    původní jednovětá zmínka o grafu.
  - `sessionContext.ts` `buildPlanSessionPrompt` (interaktivní) — nahrazeno
    „čti soubory (Read/Glob/Grep)".
  - `planPhase.ts` (headless) — nahrazeno, `Nezapisuj nic.` ponecháno.
  - `discussPhase.ts` — nahrazen dlouhý inline text, prompt-specifický konec
    („kromě poznámek nic nezapisuj…") ponechán.
- **do/auto (`autoPhase.ts`) záměrně nedotčeno** (mimo rozsah dle diskuse).

## Ověření
- `npm run typecheck` ✓, `npm test` (460 ✓), `npm run build` ✓.
- 11 snapshotů aktualizováno: `discussPhase`, `nextPhase`, `planPhase` +
  `measure` (token report, čerpá ze `sessionContext` → pokrývá interaktivní
  next+plan). **`autoPhase` snapshoty se nehnuly** (`git diff` prázdný) — potvrzuje,
  že do/auto zůstalo mimo. Hint je přítomen v aktualizovaných snapshotech
  (grep „strojovou mapu").

## Poznámky
- Konstanta je sdílená napříč 5 buildery → příští změna znění grafové instrukce je
  na jednom místě.
- `.mini/token-report.md` jsem nepřegeneroval (volitelné). Hint přidává pár set
  tokenů do next/plan/discuss promptů; do/auto beze změny.
- Kandidát na příští fázi (z diskuse): doplnit do map čísla řádků, ať cílený výřez
  funkce není dvojkrok (najdi + Read offset). Změna mapperu, ne promptu.
