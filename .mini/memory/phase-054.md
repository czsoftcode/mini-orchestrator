# Fáze 54 — Generované artefakty do .gitignore

**Cíl:** Přidat do .gitignore programově generované/odvozené výstupy v .mini/ (graph.json, graph/, last-memory.md, token-report.md, codebase.md a undo-zálohy state.prev.json/phases-prev/), odebrat je ze sledování gitem přes git rm --cached a ověřit, že je workflow (mini map / done) umí znovu vygenerovat.

## Kroky
- [hotovo] Doplnit .mini/.gitignore
- [hotovo] Untrackovat soubory z indexu
- [hotovo] Ověřit čistotu a regeneraci

## Auto-commit
- Fáze 54: Generované artefakty do .gitignore (`60c3269439e97f4744eb4609c2ef7868bc84f8f0`)

## Diskuse
# Fáze 54 — Generované artefakty do .gitignore

## Záměr
Přestat verzovat programově generované/odvozené výstupy v `.mini/`, které jdou kdykoli
znovu vytvořit. Hlavní motiv: `graph.json` + `graph/` (97 souborů) se mění prakticky
každou fází a dělají šum v diffu/commitech, přitom jsou jen derivací zdrojáků (`mini map`).

Pozn.: `.mini/.gitignore` už existuje a řeší undo-zálohy (`state.prev.json`,
`phases-prev/`) i transientní artefakty atomického zápisu grafu (`graph.tmp/`,
`graph.json.tmp`). Jádro práce tedy NENÍ psát nová pravidla od nuly, ale:
1. doplnit chybějící řádky do `.mini/.gitignore`,
2. `git rm --cached` na soubory, které byly commitnuté DŘÍV než `.gitignore` vznikl
   (proto jsou pořád sledované, i když by je pattern jinak ignoroval).

## Klíčová rozhodnutí
- **Ignorovat + untrackovat:** `graph.json`, `graph/`, `token-report.md`,
  `last-memory.md` (rozhodnutí uživatele — je čistě odvozený z `memory/`, absence je
  graceful: `next`/`discuss` jen vynechá blok „Poslední fáze", žádný pád).
- **Nechat sledovaný** (rozhodnutí uživatele):
  - `codebase.md` — jednorázový audit snapshot, regenerace stojí Claude session;
    jako přehled je užitečný i v repu.
- Patterny psát do `.mini/.gitignore` (cesty relativní k `.mini/`, tj. bez prefixu
  `.mini/`), konzistentně s existujícími řádky.

## Pozor na
- `git rm --cached` (NE `git rm`) — soubory musí zůstat na disku, jen zmizí z indexu.
  Týká se i celého adresáře `graph/` (`git rm -r --cached`).
- Po untrackování ověřit `git status`: smazané z indexu + `graph.json`/`graph/`/
  `token-report.md`/`last-memory.md` nesmí znovu naskočit jako untracked (tj.
  `.gitignore` je chytá).
- `codebase.md` musí ZŮSTAT sledovaný — nepřidávat ho do ignore, neudělat `rm --cached`.
- `last-memory.md` se untrackuje, ale na čerstvém klonu pak chybí blok „Poslední fáze"
  v `next`/`discuss` až do prvního `done` (žádný příkaz ho samostatně neregeneruje).
  Je to vědomě přijaté.
- Konstanty cest jsou v kódu (`GRAPH_DIR`/`GRAPH_INDEX` v buildGraph.ts, atd.) — tahle
  fáze je nemění, jen verzovací politiku. Ověřit, že `mini map` graf po untrackování
  pořád korektně přegeneruje a testy zůstanou zelené.

## Run report
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
