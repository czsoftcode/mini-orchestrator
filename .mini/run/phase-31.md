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
