---
phase: 64
verdict: done
steps:
  - title: "updateGraphFile v buildGraph.ts"
    status: done
  - title: "CLI flag map --file <cesty...>"
    status: done
  - title: "commands/map.ts podpora --file"
    status: done
  - title: "PostToolUse hook na Edit/Write"
    status: done
  - title: "Testy"
    status: done
verify:
  - title: "Hook reálně střílí v živé Claude Code session"
    detail: "Strojově ověřeno, že `mini map --hook` přečte hook JSON ze stdin a inkrementálně přemapuje (i tiché no-op bez file_path). Co jsem NEodzkoušel je samotná integrace v běžící session — tj. že po vložení snippetu do .claude/settings.json se PostToolUse hook po Edit/Write skutečně spustí. To chce ruční zapnutí a jednu editaci."
---

# Fáze 64 — report z auto session

## Co se udělalo

Přidána **inkrementální cesta** přemapování grafu — místo plného rebuildu sáhne jen na jeden uzel.

- **`updateGraphFile(cwd, relPath)`** v `src/graph/buildGraph.ts`: namapuje jeden soubor, atomicky (tmp+rename) přepíše `.mini/graph/<cesta>.md` a upsertne záznam v `graph.json` se zachováním `localeCompare` pořadí + bump `generatedAt`. Vrací status `updated | removed | skipped | fell-back`. Ošetřené hrany: zmizelý soubor → odebere uzel i záznam; nemapovatelná přípona / ignorovaný adresář (`node_modules`, `dist`, `.mini`, …) / cesta mimo projekt → no-op; chybějící/poškozený/jiná-verze index → fallback na plný `buildGraph`. Pomocné: `readGraphIndex` (validace), `writeGraphIndexAtomic`, `upsertEntry`, `isIgnoredPath`.
- **CLI** (`src/cli.ts`): `mini map` má teď opakovatelný `--file <cesta>` a `--hook`. `--hook` si přes nový `readHookFilePath()` přečte cestu z hook JSON na stdin (`tool_input.file_path`) — žádná závislost na `jq`. Bez cesty (jiný tool / nečitelný payload) tiše skončí, **nespustí** plný rebuild.
- **`commands/map.ts`**: `map(files?)` — když přijdou cesty, jede inkrementální `mapFiles` (per-soubor `updateGraphFile`, chyba jednoho nezhatí ostatní, krátké shrnutí). Bez cest beze změny = plný rebuild. V `--file` režimu bez mini projektu drží hubu (no spam).
- **Dokumentace**: nová sekce README „Strojová mapa projektu (graf)" s `--file`, `--hook` a hotovým snippetem do `.claude/settings.json` (`matcher: "Edit|Write|MultiEdit"`, command `mini map --hook >/dev/null 2>&1 || true`). `mini map` doplněn do tabulky příkazů. `mini init` na konci tiskne tip na zapnutí hooku pro autonomní režim.
- **Testy**: 6 unit testů `updateGraphFile` (nový soubor + pořadí, posun kotev na řádky, zmizelý soubor, nemapovatelný no-op, ignorovaný adresář, chybějící index → fell-back) + 2 testy `map --file` (přemapování jen zadaného souboru, no-spam bez projektu).

## Ověření

- `npm test` — 625 testů zelených (49 souborů).
- `npx tsc --noEmit` + `npm run build` — bez chyb.
- Smoke test reálného CLI (`node dist/cli.js`) v temp projektu: plný build → `--file` (exports `[a,b]`) → `--hook` se stdin JSON (přidá `c.ts`) → `--hook` bez `file_path` (tiché no-op, žádný rebuild). Vše OK.

## Odchylka od plánu (skeleton vs. dokumentace)

Krok „PostToolUse hook" plán zmiňoval „do skeletonu initu + dokumentace". Hook ale patří do `.claude/settings.json`, kdežto `mini` skeleton pokrývá jen `.mini/` (a `assets.test.ts` fixuje jeho obsah na přesně `['.gitignore']`). Vkládat hook config jako stray soubor do každého `.mini/` projektu nebo přepisovat cizí `.claude/settings.json` při `init` by bylo invazivní a křehké. Zvolil jsem proto **dokumentaci + copy-paste snippet v README + tip z `mini init`** — opt-in, reverzibilní, neклоbruje uživatelská nastavení. Hook jsem **vědomě nezapnul v tomto repu** během session, ať nestřílí na stale dist a nedělá šum; uživatel si ho zapne, až bude stavět autonomní režim.

## Poznámka

Snippet v README volá `mini` z PATH (`~/.local/bin/mini`). Aby měl `--hook`, musí být `mini` přelinknuté/přeinstalované na čerstvý build (proběhl `npm run build`). Pro dogfooding v tomhle repu stačí, že `mini` ukazuje na `dist/cli.js`.
