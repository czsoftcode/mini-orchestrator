---
phase: 44
verdict: done
steps:
  - title: "JS přípony v detectLang + mapper"
    status: done
  - title: "Git-aware sběr souborů v buildGraph"
    status: done
  - title: "Přepsat komentář IGNORE_DIRS"
    status: done
  - title: "Testy: gitignore + JS + fallback"
    status: done
  - title: "Zelená brána"
    status: done
verify:
  - title: "Ověřit na reálném Symfony projektu, že var/cache už není v grafu"
    detail: "Testováno syntetickou fixturou (git init + .gitignore s `var/`) — var/cache/*.php se nenamapuje, src/*.ts/.js ano. Reálný Symfony projekt jsem k dispozici neměl; stačí tam pustit `mini map` a koukout, že .mini/graph/var/ nevznikne."
---

# Fáze 44 — report z auto session

## Co se udělalo
- **`mapper.ts`**: `mapFile` volí `ScriptKind` přes nový helper `scriptKindFor`
  (`.tsx`→TSX, `.jsx`→JSX, `.js/.mjs/.cjs`→JS, jinak TS). JSX v `.js`/`.jsx` teď
  parsuje korektně.
- **`buildGraph.ts`**:
  - `detectLang` rozšířen o `.js/.jsx/.mjs/.cjs` (vrací `'ts'`).
  - Nová `collectFiles` větví zdroj seznamu: v git repu (`isGitRepo`) vezme
    `git ls-files -co --exclude-standard -z` (`collectFromGit`), jinak fallback
    na stávající `walk` + `IGNORE_DIRS`. Když git selže (chybí binárka apod.),
    `collectFromGit` vrátí `null` → fallback na walk.
  - `collectFromGit` respektuje `includeFile` opci i `.d.ts` filtr (přes
    `detectLang`). Cesty z `-z` jsou už unix-relativní ke cwd.
  - Komentář u `IGNORE_DIRS` přepsán: je to nově **fallback path** mimo git repo,
    ne globální whitelist.
  - `hasMappableProject` ponecháno na `walk` (detekce s `stopAfter:1`), git
    logika se neduplikuje.

## Testy
- `mapper.test.ts`: +2 testy (`.js` import/export, JSX v `.jsx`).
- `buildGraph.test.ts`: nový describe „v git repu respektuje .gitignore" (2 testy:
  var/ ignorováno + JS mapováno; untracked ne-ignorovaný soubor se mapuje bez
  commitu). Stávající describe běží mimo git repo → ověřuje fallback `walk` beze
  změny.

## Změny chování, které si vyžádaly úpravu existujících testů
JS je nově mapovatelné, takže tři testy, co `.js` používaly jako příklad
**ne**mapovatelného souboru, dostaly nemapovatelnou fixturu (`styles.css` /
`README.md`) a přibyl pozitivní test „jen .js → mappable":
- `buildGraph.test.ts` — `hasMappableProject ... false`
- `commands/map.test.ts` — „no mappable sources"
- `commands/done.test.ts` — „přeskočí regeneraci v non-TS projektu"

## Brána
`npm run typecheck` ✓, `npm test` (460 ✓), `npm run build` ✓. Stávající snapshoty
se nehnuly (prompt snapshoty s grafem nesouvisí; buildGraph testy běží mimo git
repo).
