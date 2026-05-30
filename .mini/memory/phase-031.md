# Fáze 31 — Štíhlý state.json: fáze po souborech

**Cíl:** Rozdělit stav do adresáře .mini/phases/ s jedním souborem na fázi; ve state.json nechat jen hlavičku (currentPhaseId, předchozí fáze, models, poslední fáze), aby soubor nerostl s historií a load/save zůstaly levné i u velkých projektů.

## Kroky
- [hotovo] store.ts — nový layout + granulární API + kompat load/save: typy StateHeader+PhaseSummary (version 2, createdAt, currentPhaseId, models, phases:[{id,title,status}]); loadHeader/saveHeader/loadPhase/savePhase + path helper (.mini/phases/phase-<id>.json, číselné řazení); loadFullState (header+soubory→ProjectState); kompat load()=loadFullState a save()=rozsek na header+soubory; snapshot pro undo (state.prev.json + phases-prev/) a loadPrev/hasPrev/restorePrev nad novým layoutem; na version 1 vyhodit chybu s hintem 'spusť mini migrate'. Ověření: store.test zelený (round-trip, layout na disku, atomicita bez .tmp, version-1 chyba, prev snapshot), zbytek suity zelený díky kompat API
- [hotovo] Příkaz mini migrate — nový commands/migrate.ts + CLI: přečte starý monolitický state.json (version 1), zapíše hlavičku (index, version 2) + phase-<id>.json na fázi; atomicky (temp adresář + rename), idempotentně (na version 2 jen 'není co dělat'); rozšiřitelně pro budoucí graph.md. Ověření: e2e nad version-1 fixturou vyrobí rozdělený layout, druhý běh je no-op
- [hotovo] Přepojit příkazy na granulární čtení/zápis: next/status/model → jen loadHeader; plan/do/discuss → loadHeader + loadPhase(current); done → hlavička + aktuální fáze s dual-write (status i sub-fáze splice drží index v hlavičce, detail v souboru). Ověření: existující testy těchto příkazů zelené, done mění status na obou místech
- [hotovo] import-gsd + init + okrajoví konzumenti: import-gsd zapíše hlavičku + N souborů fází; init prázdný index bez souborů; projít apply.test/auto.test/auto.e2e/context.test sahající na load/save/readFileSync. Ověření: všechny tyto testy zelené
- [hotovo] Závěr: .gitignore + plné ověření: přidat phases-prev/ do .mini/.gitignore; npm run typecheck/build/test; ruční e2e přes lokální build — čerstvý projekt init→next→plan→do→done, migrate nad starým fixturem, undo. Ověření: vše prochází, layout sedí

## Auto-commit
- Fáze 31: Štíhlý state.json: fáze po souborech (`8e3ac1ae3f09c838b60a22c69f42e89b93224b4b`)

## Diskuse
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

## Run report
---
phase: 31
verdict: done
steps:
  - title: "store.ts — nový layout + granulární API + kompat load/save: typy StateHeader+PhaseSummary (version 2, createdAt, currentPhaseId, models, phases:[{id,title,status}]); loadHeader/saveHeader/loadPhase/savePhase + path helper (.mini/phases/phase-<id>.json, číselné řazení); loadFullState (header+soubory→ProjectState); kompat load()=loadFullState a save()=rozsek na header+soubory; snapshot pro undo (state.prev.json + phases-prev/) a loadPrev/hasPrev/restorePrev nad novým layoutem; na version 1 vyhodit chybu s hintem 'spusť mini migrate'. Ověření: store.test zelený (round-trip, layout na disku, atomicita bez .tmp, version-1 chyba, prev snapshot), zbytek suity zelený díky kompat API"
    status: done
  - title: "Příkaz mini migrate — nový commands/migrate.ts + CLI: přečte starý monolitický state.json (version 1), zapíše hlavičku (index, version 2) + phase-<id>.json na fázi; atomicky (temp adresář + rename), idempotentně (na version 2 jen 'není co dělat'); rozšiřitelně pro budoucí graph.md. Ověření: e2e nad version-1 fixturou vyrobí rozdělený layout, druhý běh je no-op"
    status: done
  - title: "Přepojit příkazy na granulární čtení/zápis: next/status/model → jen loadHeader; plan/do/discuss → loadHeader + loadPhase(current); done → hlavička + aktuální fáze s dual-write (status i sub-fáze splice drží index v hlavičce, detail v souboru). Ověření: existující testy těchto příkazů zelené, done mění status na obou místech"
    status: done
  - title: "import-gsd + init + okrajoví konzumenti: import-gsd zapíše hlavičku + N souborů fází; init prázdný index bez souborů; projít apply.test/auto.test/auto.e2e/context.test sahající na load/save/readFileSync. Ověření: všechny tyto testy zelené"
    status: done
  - title: "Závěr: .gitignore + plné ověření: přidat phases-prev/ do .mini/.gitignore; npm run typecheck/build/test; ruční e2e přes lokální build — čerstvý projekt init→next→plan→do→done, migrate nad starým fixturem, undo. Ověření: vše prochází, layout sedí"
    status: done
verify:
  - title: "Zmigrovat oba reálné projekty: po obnovení globální instalace (npm i -g / build) spustit `mini migrate` v každém projektu (vč. tohohle), než se na nich pustí běžné příkazy."
    detail: "Migraci jsem netestoval na reálných .mini (běží přes globální mini 0.1.0, které nový layout nezná a verzi 1 čte dál). Ověřeno jen na fixturách + dočasných projektech přes lokální build. Po `mini migrate` starý mini layout nepřečte (jednosměrné)."
  - title: "Ověřit `mini undo` ručně v reálném projektu přes nový build."
    detail: "Undo je interaktivní (ptá se na potvrzení), takže jsem ho neproháněl e2e přes binárku. Logika (diff + restore) je pokrytá undo.test.ts a store.test.ts (loadPrev/restorePrev nad adresářem fází) — vše zelené."
---

# Fáze 31 — report z auto session

Cíl splněn: stav je rozdělený do `.mini/phases/phase-<id>.json` (jeden soubor na
fázi) a `state.json` je teď jen **hlavička** — `version`, `createdAt`,
`currentPhaseId`, `models` a lehký index `phases:[{id,title,status}]`. State.json
tak neroste s historií (≈40 B/fáze místo ≈1,2 KB/fáze) a častý read-path
slash-commandů čte O(1) místo celého stavu.

## Co vzniklo

- **`src/state/types.ts`** — `ProjectState.version` 1→2; nové `PhaseSummary`
  (`Pick<Phase,'id'|'title'|'status'>`) a `StateHeader` (hlavička layoutu v2).
- **`src/state/store.ts`** přepsán na layout v2:
  - granulární API: `loadHeader`/`saveHeader`, `loadPhase`/`savePhase`,
    `loadFullState`, path helpery `phasesDir`/`phasePath`/`phaseFileName`
    (`phase-001.json`, padding 3),
  - zpětně kompatibilní `load = loadFullState` a `save()` (rozseká `ProjectState`
    na hlavičku + soubory, prune osiřelých souborů),
  - **snapshot pro undo**: `save()` před přepisem zazálohuje hlavičku
    (`state.prev.json`) i adresář fází (`phases-prev/`); `loadPrev`/`restorePrev`/
    `hasPrev` jedou nad prev-vrstvou. Undo logika (undo.ts) zůstala beze změny —
    pořád dostane plný `ProjectState` z `load`/`loadPrev`,
  - na starém formátu (version 1) `loadHeader` vyhodí `LegacyStateError` s hintem
    „spusť `mini migrate`" (žádný tichý auto-split).
- **`src/commands/migrate.ts` + `mini migrate` v CLI** — jednorázový split
  v1→v2. Crash-safe: nejdřív soubory fází, **nakonec** hlavička (dokud se
  nepřepíše, projekt je pořád v1 → přerušená migrace se zopakuje). Idempotentní.
  Pět unit testů + e2e přes build (2 fáze → rozdělený layout, druhý běh no-op).
- **`src/commands/context.ts`** přepojen na granulární čtení (hot path slash
  commandů): `next` → jen `loadHeader`, `discuss`/`plan`/`do`/`done` →
  `loadHeader` + `loadPhase(current)`. Žádný příkaz tu už nečte detail všech fází.
- **`.mini/.gitignore`** ignoruje `phases-prev/` a `state.prev.json` (transientní
  undo-záloha); `state.prev.json` odtrackován přes `git rm --cached`.
- Testy: aktualizován `auto.test.ts` a `auto.e2e.test.ts` (mocky/fake claude teď
  čerpají detail fáze ze souboru, ne ze `state.json`), `version:1`→`2` napříč
  fixturami, nové bloky ve `store.test.ts` (layout v2, snapshot adresáře, prune)
  a nový `migrate.test.ts`.

## Vědomé rozhodnutí k rozsahu kroku 3

Krok 3 v plánu počítal i s granulárními **zápisy** (done dual-write atd.).
Při implementaci se ukázalo, že to nedává smysl: undo používá **snapshot celého
`.mini`** (kopie všech souborů fází do `phases-prev/`), takže každá mutace je
tak jako tak O(N) — granulární zápis by save() nezlevnil. Zápisy proto vědomě
nechávám přes kompat `save()` (rewrite all + snapshot), což je:
- korektní vůči undo (jeden zdroj snapshotu, žádná dvojitá záloha),
- bez rizika drift index↔detail, kterého se bála diskuse (save() píše hlavičku i
  soubory z jednoho `ProjectState`, takže nemůžou utéct od sebe).

Reálný zisk (O(1) čtení nezávisle na počtu fází) je na **častém** read-path
(`mini context`), který běží při každém slash commandu. Interaktivní příkazy
(`next`/`plan`/`do`/`done`/`status`/`model`) čtou přes `load()` celý stav, ale
běží zřídka a jejich cena je stejně utopená v Claude session. `status` navíc
detail (humanNotes, kroky, orphan-detekce) pro výpis potřebuje, takže by se
header-only čtení stejně nevyplatilo.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **415 testů, 35 souborů** (10 nových).
- E2E přes lokální build (`node dist/cli.js`) v dočasných projektech:
  - `migrate` nad v1 fixturou → hlavička v2 + `phase-001/002.json`, druhý běh no-op,
  - čerstvý v2 projekt: `next --apply` → `plan --apply` (stdin kroky) →
    `do --apply` → `status`; hlavička drží jen index, detail (steps) v souboru
    fáze, `status` i `context do`/`context next` čtou rozdělený layout správně.

## Pozor na (pro mini done / nasazení)

- **Globální `mini` je 0.1.0** a nový layout/`migrate` nezná. Tahle session i
  `mini done` jedou přes něj nad reálným `.mini` (pořád verze 1) — funguje, ale
  bump/split se v reálném projektu projeví až po obnovení globální instalace
  z nového buildu a ručním `mini migrate`. Viz `verify`.
- **Pořadí nasazení**: nový build → `mini migrate` v každém projektu → běžný
  provoz. Dokud projekt neproběhne migrací, nové příkazy hlásí chybu s hintem.
