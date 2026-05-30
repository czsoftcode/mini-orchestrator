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
