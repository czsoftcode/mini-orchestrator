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
