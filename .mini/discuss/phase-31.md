# Fáze 31 — Štíhlý state.json: fáze po souborech

## Záměr
Rozdělit stav tak, aby `state.json` nerostl lineárně s historií a aby běžné
příkazy nečetly detail všech fází. Dnes je vše v jednom `state.json` (~36 KB /
30 fází, drtivá většina = `steps[]` hotových fází) a `load()` ho parsuje celý
při každém příkazu, `save()` ho celý přepisuje + zálohuje do `state.prev.json`.

Cílový layout `.mini/`:
- `state.json` = **hlavička**: `version`, `createdAt`, `currentPhaseId`,
  `models` a **lehký index všech fází** `phases: [{ id, title, status }]`.
- `.mini/phases/phase-<id>.json` = **detail jedné fáze** (`goal`, `steps[]`,
  `humanNotes`, `startedAt`, `completedAt`, `autoCommit`, `resolvedVerify`).

## Klíčová rozhodnutí
- **Hlavička s lehkým indexem všech fází.** `mini status` i `mini context next`
  potřebují přehled všech fází (id/title/status) — ten zůstane v hlavičce, takže
  oba čtou jen `state.json`, ne soubory fází. (`buildNextPhasePrompt` z fází bere
  jen id/title/status; detail poslední fáze stejně tahá z `last-memory.md`.)
- **Granulární API ve `store.ts`** místo jediného `load()`/`save()` celého stavu:
  - `loadHeader(cwd)` / `saveHeader(cwd, header)` — hlavička (index + models).
  - `loadPhase(cwd, id)` / `savePhase(cwd, phase)` — detail jedné fáze.
  - Volitelně `loadFullState(cwd)` (sesype hlavičku + všechny fáze do
    `ProjectState`) — využije hlavně `undo`; ostatní příkazy ho nepoužívají.
  - Mapování potřeb příkazů: `next`/`status`/`model` → jen hlavička;
    `plan`/`do`/`discuss` → hlavička (kvůli `currentPhaseId`) + `loadPhase(current)`;
    `done` → hlavička + aktuální fáze; `undo` → celý snapshot.
- **Dual-write u `done` musí držet index a detail v souladu.** Když `done` mění
  `status` (nebo vkládá sub-fázi), musí aktualizovat jak `phase-<id>.json`, tak
  odpovídající záznam v `header.phases`. Pořadí fází (vč. splice sub-fáze) žije
  v `header.phases`.
- **Undo = snapshot celého `.mini`.** Před zápisem zálohovat hlavičku
  (`state.json` → `state.prev.json`) **i** adresář fází
  (`.mini/phases/` → `.mini/phases-prev/`, kompletní zrcadlo). `undo` pak prev
  vrstvu sesype do `ProjectState` a spustí **stejný diff/revert jako dnes**
  (`describeDiff`, `findRevertedAutoCommit`, `restorePrev`) — chování undo se
  nemění. `hasPrev`/`restorePrev` rozšířit o adresář fází.
- **Migrace explicitním příkazem, ne automaticky.** Místo migrace v `load()`
  přidat samostatný Bash příkaz `mini migrate` (název doladit v plánu), který
  rozseká starý monolitický `state.json` (version 1) do nového layoutu:
  pro každou fázi vytvoří `.mini/phases/phase-<id>.json`, hlavičku přepíše na
  index + `version: 2`. Spouští se ručně (u mini reálně jen 2 projekty), takže
  hot path zůstává bez I/O migrace.
  - `load*`/`loadHeader` při narazu na **version 1** (starý formát) **nepřepisuje
    tiše**, ale skončí jasnou chybou s hintem „spusť `mini migrate`". Žádný
    skrytý auto-split.
  - Migrace atomicky (temp adresář + `rename`), ať pád uprostřed nenechá
    půlrozsekaný stav; idempotentní (na už zmigrovaném version 2 jen řekne, že
    není co dělat).
  - **Budoucí rozšíření (mimo tuto fázi):** stejný příkaz později pobere i
    `graph.md`, který taky roste — návrh `mini migrate` udělat tak, aby šel
    rozšířit o další migrační kroky, ale teď řešit jen `state.json`.
  - Dnešní čistou `migrate()` (in-memory `model`→`models`) ponechat beze změny —
    běží dál nad načtenou hlavičkou.
- **Atomicita zápisů zachovat** (temp soubor + `rename`), jako dnes u `save`.
- **Formát názvu souboru** s paddingem kvůli řazení v adresáři, např.
  `phase-001.json` (doladit v plánu — stačí i `phase-<id>.json`, řadit číselně).

## Pozor na
- **`undo` je jediný konzument celého stavu** — ověřit, že `loadFullState`
  (hlavička + všechny `phase-*.json`) dá přesně stejný `ProjectState` jako dnešní
  `load()`, jinak se rozbije diff kroků (`collectStatusChanges` porovnává
  `steps` po indexech).
- **Drift index ↔ detail.** Title/status jsou na dvou místech (hlavička + soubor).
  Jediný zdroj pravdy pro pořadí a souhrn = hlavička; detail = soubor. `done` a
  případně `import-gsd` musí psát obě části. Zvážit test, že index odpovídá
  souborům.
- **`import-gsd`** zakládá mnoho fází naráz — musí zapsat hlavičku + N souborů
  fází (ne jeden velký `save`). Zkontrolovat i `init` (`newState` → prázdný
  index, žádné soubory) a `apply.test.ts`/`*.e2e`/`auto.test.ts`, které dnes
  čtou/píšou `state.json` přímo přes `load`/`save` nebo `readFileSync`.
- **`state.prev.json` dnes čte jen `undo`** (`hasPrev`, `loadPrev`,
  `restorePrev`) — nic jiného se na jeho formát neváže, takže přechod na
  „snapshot + adresář" je bezpečný.
- **`.gitignore` / commit fází.** Auto-commit (`add -A`) teď pobere i
  `.mini/phases/` a `.mini/phases-prev/`. Rozhodnout, zda `phases-prev/`
  ignorovat (je to jen undo-záloha), aby neplnila historii — doladit v plánu.
- **Zpětná migrace jen jedním směrem.** Po `mini migrate` (version 2) starý
  `mini` (0.1.0 globálně) nový layout nepřečte — zmínit, ne řešit.
- **Pořadí nasazení:** napřed nový build s `mini migrate`, pak na obou
  existujících projektech ručně spustit migraci, teprve pak běžné příkazy.
  Dokud projekt neproběhne migrací, příkazy hlásí chybu + hint (viz výše).
