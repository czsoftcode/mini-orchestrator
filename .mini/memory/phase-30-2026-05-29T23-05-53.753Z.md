# Fáze 30 — Done: verze, push a clear

**Cíl:** Rozšířit mini done --apply tak, aby po finalizaci fáze navýšil verzi v package.json (patch), zahrnul ji do auto-commitu, nahrál na remote přes git push a na závěr vypsal nabídku spustit /clear pro vyčištění kontextu.

## Kroky
- [hotovo] Bump helper + testy: přidat bumpPackageVersion(cwd, level) v novém modulu src/version.ts — načte package.json, navýší semver dle level (patch/minor/major), zapíše zpět se zachováním formátu, chybějící package.json tiše vrátí null; unit testy pro patch/minor/major, chybějící soubor, zachování formátu
- [hotovo] Push helper + test: přidat push(cwd) do git.ts (best-effort přes runGit(push), vrací GitResult); test že volá git push a chybu nehází
- [hotovo] Zapojit do finalizace: rozšířit finalizePhaseSideEffects a commitPhaseWork o FinalizeOptions { bump, push } — bump verze před commitem (pobere ho add -A), po commitu push jen když push===true, vše best-effort; protáhnout options ze všech tří cest (applyAutoReport, collectNotesAndSave, finalizePhase)
- [hotovo] CLI flagy: mini done [--apply] --bump <patch|minor|major> --push a mini auto --bump <...> --push (default patch); předat do finalizace
- [hotovo] Nabídka /clear + session prompt: po úspěšné finalizaci vypsat hint na /clear; rozšířit buildDoneSessionPrompt (mini context done), ať Claude po uzavření navrhne /clear a zmíní možnost --push
- [hotovo] Ověření: typecheck/build/test + e2e přes lokální build — verze povýšená a v commitu fáze, --push bez remote skončí jen warningem, /clear hint se vypíše

## Auto-commit
- Fáze 30: Done: verze, push a clear (`eda2565f855e2aafa97707d963657ba0ba9ad3a4`)

## Diskuse
# Fáze 30 — Done: verze, push a clear

## Záměr
Po finalizaci fáze (`phase.status = done`) má `mini done` navíc:
1. navýšit verzi v `package.json` (default **patch**),
2. tu změnu zahrnout do auto-commitu fáze,
3. volitelně pushnout na remote,
4. na závěr vypsat nabídku spustit `/clear` (vyčištění kontextu session).

Cílem je, aby cyklus přes slash commandy končil "uklizeně" — verze povýšená,
práce na remote, kontext připravený k vyčištění před další fází.

## Klíčová rozhodnutí
- **Verze: automatický patch + flag pro větší skok.** Každá hotová fáze navýší
  patch (`x.y.Z+1`) v `package.json`. Nový flag `--bump <patch|minor|major>`
  (default `patch`) umožní minor/major. Bump se děje **před commitem**, aby ho
  `git add -A` pobral do commitu fáze.
- **Push: opt-in přes `--push`.** Default zůstává jako dosud (jen hint
  `git push`) — dosavadní vědomé rozhodnutí z fáze 11 se neruší, jen se přidá
  možnost. Push je **best-effort**: chybějící remote/upstream nebo selhání = jen
  warning + hint, workflow nespadne (stejně jako commit nikdy nehází).
- **Rozsah: sdílené ve finalizaci.** Chování (bump + případný push) zapojit tam,
  kde fáze končí jako `done` — tj. `applyDone`, interaktivní `done` i `auto`, aby
  se chovaly stejně. Flag `--push` (a `--bump`) protáhnout z CLI do finalizace
  ve všech těchto cestách.
- **`/clear` se jen nabízí.** `/clear` je vestavěný příkaz Claude Code, který
  musí napsat uživatel — `mini` z Bashe ho spustit nemůže. Takže `mini done`
  jen **vypíše nabídku/hint**, ať uživatel zváží `/clear`. Navíc `mini context
  done` (session prompt) zmíní, ať Claude `/clear` po uzavření fáze navrhne.
- **Pořadí side-effectů:** bump verze → commit (`add -A`) → push (jen s `--push`)
  → memory + graf (ty zůstávají mimo commit, jako dosud).
- **Bez package.json: tiše přeskočit bump.** Per-projekt/jazyk konfigurace
  (např. dotaz při `init`, jiný způsob verzování pro PHP/Rust) je **na jinou fázi**.

## Pozor na
- **`mini undo` po pushi.** `undo` dělá soft reset na `phase.autoCommit.preSha`.
  Když se commit už pushnul, lokální reset diverguje od remote (nutný force-push).
  Bump verze je součástí commitu fáze, takže `undo` ho korektně vrátí do stagingu;
  problém je jen s remote. Pro teď: push je opt-in, takže riziko bere uživatel
  vědomě — zmínit v hintu/dokumentaci, neřešit force-push automaticky.
- **Bump musí předcházet commitu**, jinak skončí mimo commit fáze (jako memory/graf)
  a rozbije se vazba undo ↔ verze. Capture `preSha` je HEAD před commitem fáze
  (předchozí fáze) — editace working tree (bump) ho nemění, takže pořadí
  bump → preSha → commit je v pořádku.
- **Parsování/zápis `package.json`** dělat opatrně: zachovat formátování (odsazení,
  koncový newline), ať diff obsahuje jen řádek `version`. Nepoužívat `npm version`
  (vytváří vlastní commit/tag) — verzi zapsat sami a nechat ji pobrat commitem fáze.
- **Idempotence/skipped fáze:** u `skipped` se finalizace side-effectů nevolá, takže
  bump ani push se tam nedějí — zachovat.
- **Slash command `/mini:done`** dnes volá `mini done --apply [--accept-verify]`.
  Pokud má jít push z session, je třeba, aby se `--push` dal předat — buď to zmínit
  v session promptu (Claude doplní `--push` na přání uživatele), nebo nechat push
  čistě na ručním `git push`. Zvážit v plánu, ať je flow jasné.

## Run report
---
phase: 30
verdict: done
steps:
  - title: "Bump helper + testy: přidat bumpPackageVersion(cwd, level) v novém modulu src/version.ts — načte package.json, navýší semver dle level (patch/minor/major), zapíše zpět se zachováním formátu, chybějící package.json tiše vrátí null; unit testy pro patch/minor/major, chybějící soubor, zachování formátu"
    status: done
  - title: "Push helper + test: přidat push(cwd) do git.ts (best-effort přes runGit(push), vrací GitResult); test že volá git push a chybu nehází"
    status: done
  - title: "Zapojit do finalizace: rozšířit finalizePhaseSideEffects a commitPhaseWork o FinalizeOptions { bump, push } — bump verze před commitem (pobere ho add -A), po commitu push jen když push===true, vše best-effort; protáhnout options ze všech tří cest (applyAutoReport, collectNotesAndSave, finalizePhase)"
    status: done
  - title: "CLI flagy: mini done [--apply] --bump <patch|minor|major> --push a mini auto --bump <...> --push (default patch); předat do finalizace"
    status: done
  - title: "Nabídka /clear + session prompt: po úspěšné finalizaci vypsat hint na /clear; rozšířit buildDoneSessionPrompt (mini context done), ať Claude po uzavření navrhne /clear a zmíní možnost --push"
    status: done
  - title: "Ověření: typecheck/build/test + e2e přes lokální build — verze povýšená a v commitu fáze, --push bez remote skončí jen warningem, /clear hint se vypíše"
    status: done
---

# Fáze 30 — report z auto session

Cíl fáze splněn: `mini done` (i `auto`) teď při uzavření fáze navýší verzi v
`package.json`, zahrne ji do commitu fáze, volitelně pushne na remote a nabídne
`/clear`. Vše best-effort — nic z toho workflow nezablokuje.

## Co vzniklo

- **`src/version.ts`** — `bumpSemver(version, level)` (čistá funkce) a
  `bumpPackageVersion(cwd, level='patch')`. Verzi v `package.json` mění **textovou
  náhradou** jen hodnoty u `"version"`, takže diff je jediný řádek (žádné
  přeformátování přes `JSON.stringify`, žádné `npm version`). Chybějící
  `package.json` nebo chybějící/nevalidní `version` → tiše `null`. Plus `BumpLevel`
  typ a `isBumpLevel` guard.
- **`push(cwd)` v `src/git.ts`** — best-effort `runGit(['push'])`, vrací `GitResult`,
  nikdy nehází.
- **Zapojení do finalizace** (`src/commands/done.ts`): nový `FinalizeOptions
  { bump?, push? }` (v `commands/types.ts`). `commitPhaseWork` teď: **bump verze
  (default patch) → commit (`add -A` ji pobere) → push jen při `push===true`**.
  `finalizePhaseSideEffects` i `commitPhaseWork` berou options; protaženo všemi
  třemi finalizačními cestami (`collectNotesAndSave`, `applyAutoReport`,
  `finalizePhase`). `ApplyReportOptions extends FinalizeOptions`. `AutoOptions`
  rozšířeno o `bump`/`push`, takže i interaktivní `done` a `auto` se chovají stejně.
- **CLI flagy** (`src/cli.ts`): `mini done [--apply] --bump <patch|minor|major> --push`
  a `mini auto --bump <…> --push` (default patch), s validací `parseBumpLevel`.
  `mini auto` je předává do `done({auto})` přes `auto.ts`.
- **`/clear` nabídka**: `applyDone` po skutečném uzavření fáze vypíše hint na `/clear`.
  `buildDoneSessionPrompt` (= `mini context done`) instruuje Claude `/clear` nabídnout
  a zmiňuje opt-in `--push` i možnost `--bump minor|major`.
- Push hint mimo `--push` upraven na `git push (nebo mini done --push)`.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **403 testů, 34 souborů** (15 nových: version.test.ts, push test
  v git.test.ts, /clear+push test v sessionContext.test.ts).
- E2E přes lokální build (`node dist/cli.js`) ve dvou dočasných git repech:
  1. `done --apply --accept-verify` (default): verze **0.3.0 → 0.3.1**, změna
     `package.json` je **součástí commitu fáze** (`git show` ji ukazuje), working
     tree po commitu čistý, `/clear` hint vypsán.
  2. `done --apply --accept-verify --bump minor --push` bez remote: verze
     **1.0.0 → 1.1.0**, commit proběhl, push skončil **warningem** („No configured
     push destination"), ale příkaz vrátil **exit 0** — workflow nespadl.

## Poznámky / pozor na

- **`mini undo` po pushi** zůstává ošemetné (soft reset lokálně vs. remote =
  divergence). Push je opt-in, riziko bere uživatel vědomě — neřešeno automaticky,
  zmíněno už v diskusi.
- **Globální `mini` na PATH je verze 0.1.0** a tyto flagy/chování nezná. Skutečné
  `/mini:done` v této session pojede přes starý binárka — bump/push se projeví až
  po obnovení globální instalace z nového buildu (mimo rozsah fáze).
- Bez `package.json` se bump tiše přeskočí; per-jazyk verzování (PHP/Rust, dotaz
  při `init`) je samostatná budoucí fáze (dle diskuse).
