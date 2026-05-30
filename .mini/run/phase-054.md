---
phase: 54
verdict: done
steps:
  - title: "Doplnit .mini/.gitignore"
    status: done
  - title: "Untrackovat soubory z indexu"
    status: done
  - title: "Ověřit čistotu a regeneraci"
    status: done
---

# Fáze 54 — report z auto session

## Co se udělalo
- **`.mini/.gitignore`** rozšířen o programově generované/odvozené výstupy (cesty relativní k `.mini/`, s komentářem proč):
  - `graph/` + `graph.json` — strojová mapa projektu (derivace zdrojáků, `mini map` / `done`).
  - `token-report.md` — report z měření tokenů.
  - `last-memory.md` — zeštíhlené shrnutí poslední fáze, odvozené z `.mini/memory/`.
  - `codebase.md` **NEpřidán** — dle rozhodnutí z diskuse zůstává sledovaný (jednorázový audit snapshot, regenerace stojí Claude session).
- **Untrackováno z indexu** přes `git rm -r --cached`: `.mini/graph.json`, `.mini/graph/` (96 map), `.mini/token-report.md`, `.mini/last-memory.md`. Soubory zůstaly na disku.

## Ověření (strojově)
- `git ls-files .mini/` už neobsahuje žádný z untrackovaných souborů (match count = 0); `codebase.md` dál sledovaný.
- Soubory dál existují na disku (graph.json, graph/, token-report.md, last-memory.md).
- `git status .mini/` — generované soubory jsou `D ` (smazané z indexu), **žádný z nich nenaskočil jako `??`**. Untracked zůstaly jen běžné stavové soubory nové fáze (discuss/memory/phases).
- `mini map` graf korektně přegeneroval (98 souborů, graph.json na disku) a **po regeneraci nenaskočil jako `??`** — `.gitignore` ho chytá.
- `npm test` → **522 passed (40 souborů)**, zelené.

## Poznámky
- `.mini/.gitignore` už dřív řešil undo-zálohy (`state.prev.json`, `phases-prev/`) a transientní artefakty zápisu grafu (`graph.tmp/`, `graph.json.tmp`) — ty zůstaly beze změny.
- Untrackování se v `git status` projeví jako velký blok `D` záznamů (smazání z indexu u dosud commitnutých souborů) — to je očekávané a součást změny, kterou `mini done` zacommituje. Soubory fyzicky nezmizely.
- Na čerstvém klonu teď chybí `last-memory.md` až do prvního `done`; `next`/`discuss` v tom případě jen vynechá blok „Poslední fáze" (graceful, žádný pád). Vědomě přijaté v diskusi.
