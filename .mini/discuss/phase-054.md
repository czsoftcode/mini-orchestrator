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
