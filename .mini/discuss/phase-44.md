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
