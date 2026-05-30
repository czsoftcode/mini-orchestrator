# Fáze 44 — Map respektuje .gitignore

**Cíl:** mini map při procházení projektu přeskočí soubory a adresáře odpovídající .gitignore v kořeni projektu (vedle stávajícího IGNORE_DIRS), aby se do grafu nedostaly ignorované runtime/build artefakty (např. Symfony var/cache); ověřitelné unit testem s fixturou .gitignore + zelená brána (typecheck, testy, build).

## Kroky
- [hotovo] JS přípony v detectLang + mapper
- [hotovo] Git-aware sběr souborů v buildGraph
- [hotovo] Přepsat komentář IGNORE_DIRS
- [hotovo] Testy: gitignore + JS + fallback
- [hotovo] Zelená brána

## Auto-commit
- Fáze 44: Map respektuje .gitignore (`073937357dc63d9fa2b65884f81396866d1b2940`)

## Diskuse
# Fáze 44 — Map respektuje .gitignore

## Záměr
`buildGraph` (`src/graph/buildGraph.ts`) dnes prochází strom přes pevný whitelist
`IGNORE_DIRS` a `.gitignore` záměrně ignoruje (komentář na `:18-21`). Symfony
`var/cache` v whitelistu není → propadne do grafu. Fáze má graf přimět
respektovat `.gitignore`, aby se ignorované runtime/build artefakty nemapovaly.

## Klíčová rozhodnutí
- **Rozsah fáze = .gitignore filtr + rozšíření whitelistu o JS** (`.js/.jsx/.mjs/.cjs`).
  Tyto přípony se dnes nemapují vůbec, přitom je TS mapper zvládne. Záměrně NE
  „mapovat vše z gitu" — `mapByLang` (`buildGraph.ts:162`) umí jen ts/php/rust;
  pro CSS/JSON/YAML/MD by vznikaly prázdné staby bez navigační hodnoty + token
  bloat (proti trendu fází 31–43). „Mapovat víc/všechno" je samostatná budoucí
  fáze (vyhodnotit token dopad), ne tahle.
- **Vyhodnocení .gitignore delegovat na git**, neparsovat patterny vlastním kódem
  (sémantika .gitignore je záludná). Máme `runGit` helper (`src/git.ts`).
- **V git repu se řídit výhradně gitem**: místo `walk` vzít seznam souborů ze
  `git ls-files -co --exclude-standard -z` (tracked + untracked-ne-ignorované),
  odfiltrovat podle přípon (`detectLang`, vyhodit `.d.ts`). Git sám vyřeší `.git`,
  `node_modules`, `var/cache` i vnořené `.gitignore` a negace.
- **Mimo git repo / bez git binárky** → fallback na stávající `walk` + `IGNORE_DIRS`
  (zachovat beze změny). Detekce repa: `isGitRepo` z `src/git.ts`; `runGit` nikdy
  nehází (ENOENT → ok:false), takže fallback je přirozený.
- `IGNORE_DIRS` tedy zůstává jako fallback path, není to backstop nad git větví.
  Komentář na `buildGraph.ts:18-21` přepsat (rozhodnutí se mění).

## Pozor na
- **JS scriptKind**: `mapFile` (`mapper.ts:27`) dnes rozlišuje jen `.tsx` →
  jinak `ScriptKind.TS`. Pro JS doplnit: `.js/.cjs/.mjs` → `ScriptKind.JS`,
  `.jsx` → `ScriptKind.JSX` (jinak JSX v `.js`/`.jsx` neparsuje). `detectLang`
  rozšířit o JS přípony (vrací `lang: 'ts'`, scriptKind řeší mapper podle cesty).
- **`-z` (NUL-separované)** místo prostého stdout — git jinak cesty se speciálními
  znaky uvozuje/escapuje. Cesty z gitu jsou už s `/` (není třeba `toUnix`).
- **`includeFile` opce** (`BuildGraphOptions`) musí platit i nad git seznamem.
- **`hasMappableProject`** nech na stávajícím `walk` (`collectMappableFiles` se
  `stopAfter:1`, kontroluje hlavně tsconfig/Cargo/composer) — neduplikovat git
  logiku do detekce.
- **Tracked soubor, co je i v `.gitignore`** → `ls-files -c` ho zahrne; to je
  správně (commitnutý = patří do grafu). Nezahazovat.
- **Smazaný-ale-tracked soubor** (`ls-files -c` ho vrátí, na disku chybí) — řeší
  už `readFile` try/catch v `buildGraph` (best-effort skip).
- **Test:** temp projekt s `git init` + fixturou `.gitignore` (`var/cache` nebo
  `/var/`), ověřit že `var/cache/*.php` se nenamapuje a `src/*.ts` ano. Druhý test:
  bez `git init` → pořád funguje `walk` + `IGNORE_DIRS` (stávající chování beze
  změny). Pozor: testy běží nad temp direm bez gitu, takže nový test musí git repo
  založit explicitně; vyžaduje git binárku v test prostředí.
- **Determinismus**: po načtení ze `ls-files` zachovat sort (`graphs.sort` už je).
- **Snapshoty**: stávající snapshoty buildGraphu by se hnout neměly (běží mimo git
  repo → fallback walk), ověřit `npm test`.
- Brána zelená: `npm run typecheck`, `npm test`, `npm run build`.

## Run report
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
