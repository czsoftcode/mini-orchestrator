# Fáze 78 — Anglické CLI + UI hlášky

**Cíl:** Přeložit do angličtiny veřejně viditelnou runtime vrstvu: popisy příkazů/options a help v src/cli.ts a výstupní/interaktivní řetězce v src/ui/* (ask, interactive, streamRender, usage). Komentáře/JSDoc smí v této fázi zůstat česky (přijdou na řadu později). Ověřit přes mini --help a zelené npm test + build.

## Kroky
- [hotovo] Přeložit src/cli.ts do AJ
- [hotovo] Přeložit src/ui/* do AJ
- [hotovo] Upravit UI testy na anglické řetězce
- [hotovo] Přeložit meta soubory
- [hotovo] Ověřit výstup a zelený build

## Auto-commit
- Fáze 78: Anglické CLI + UI hlášky

## Diskuse
# Fáze 78 — Anglické CLI + UI hlášky

## Záměr

První díl většího kroku **„celý program → angličtina"**. Nový směr projektu
(rozhodnutí uživatele v této diskusi): vše uvnitř programu je anglicky — UI,
chybové hlášky, logy i komentáře/JSDoc. Česky zůstává **jen** `CLAUDE.md` (jako
soubor) a naše komunikace v chatu + commit messages. Cíl: aby byl nástroj
mezinárodní a šel zveřejnit.

Tahle fáze bere nejviditelnější runtime vrstvu + související meta soubory. Další
fáze pak naberou `src/commands/*`, reporty/memory (`state/*`, `writeMemory`),
graph mappery atd.

## Klíčová rozhodnutí

Záběr fáze 78 (rozšířený oproti původnímu `goal` — viz „Pozor na"):

1. **`src/cli.ts`** — přeložit VŠE: `.description` příkazů, texty `.option`,
   validační/chybové hlášky (`parseMaxTurns`, `parseBumpLevel`,
   `ensurePushHasBump`, `requireOption`), potvrzovací message u `renumber`
   (~ř. 270) **a všechny komentáře/JSDoc**.
2. **`src/ui/*`** — přeložit runtime řetězce i komentáře:
   - `ask.ts`: `'Zrušeno.'`, default `'Pole nesmí být prázdné.'`
   - `streamRender.ts`: `'Claude session spuštěna'`, `'… selhal'`,
     `'nástroj selhal'` + JSDoc
   - `usage.ts`: `'tokenů'`, `'z cache'`, `'v API'`, `'Souhrn streamu'` +
     `pluralTurns` → v AJ kolaps na `turn`/`turns` (zjednodušit/přejmenovat) + JSDoc
   - `interactive.ts`: jen JSDoc komentář (teď v záběru, protože překládáme i komentáře)
   - `log.ts`: žádná čeština (nic k překladu)
3. **`package.json` `description`** — přeložit (veřejný popis na npm), ať je
   konzistentní s root `program.description` v `cli.ts:80`.
4. **`CLAUDE.md`** — upravit jazykové pravidlo **teď**: program (UI, hlášky,
   logy, komentáře) je anglicky; česky zůstává jen chat a commity. Samotný
   `CLAUDE.md` zůstává psaný česky.
5. **`docs/i18n-glossary.md`** — přepsat zastaralý předpoklad (ř. 8–9, 119–120
   říkají „CLI/UI logy zůstávají česky" — to už neplatí) a přidat sekci s
   kanonickými CLI/UI termíny pro konzistenci dalších fází.
6. **Testy v lockstepu**: `src/ui/streamRender.test.ts` (asserty ř. 29, 68) a
   `src/ui/usage.test.ts` (asserty ř. 39–42) — upravit očekávané řetězce na AJ.

Co se NEpřekládá (beze změny): názvy příkazů, flagy, `/mini:*` reference, cesty
(`.mini/…`, `.claude/commands/…`), identifikátory v kódu, response-kontrakt
(`TITLE:`/`GOAL:`/`STEP:` …), stavová slova.

Ověření: `mini --help` čte hezky anglicky + zelené `npm test` a `npm run build`.

## Pozor na

- **Uložený `goal` fáze obsahuje větu „Komentáře/JSDoc smí v této fázi zůstat
  česky" — ta je touto diskusí ZRUŠENA.** Komentáře v `cli.ts` + `ui/*`
  překládáme taky. Tyhle poznámky mají přednost.
- **Testovací fixtury vs. UI řetězce:** v `streamRender.test.ts` jsou vstupy jako
  `'Pracuji na tom'` / `'další řádek'` simulace Claudova textu, NE naše UI —
  ty NEpřekládat. Měnit jen asserty na výstupní řetězce našeho UI
  (`'Claude session spuštěna'`→ EN, `'Bash selhal'`→ EN, `'Souhrn streamu'`→ EN,
  `'3 odpovědi'`→ EN, `'z cache'`→ EN).
- **`pluralTurns`**: čeština má 3 tvary (odpověď/odpovědi/odpovědí), AJ jen 2
  (`turn`/`turns`). Funkci zjednodušit (`n === 1 ? 'turn' : 'turns'`), případně
  přejmenovat; ověřit, že to nerozbije volající v `usage.ts`.
- **Grep falešné shody:** `next.test.ts`, `measure.test.ts`, `writeMemory.test.ts`
  obsahují slova jako „tokenů/odpovědí", ale testují vlastní moduly mimo záběr —
  v této fázi se jich NEdotýkat.
- **Konzistence root popisu:** `program.description` v `cli.ts` a `description` v
  `package.json` ať říkají totéž (anglicky).

## Run report
---
phase: 78
verdict: done
steps:
  - title: "Přeložit src/cli.ts do AJ"
    status: done
  - title: "Přeložit src/ui/* do AJ"
    status: done
  - title: "Upravit UI testy na anglické řetězce"
    status: done
  - title: "Přeložit meta soubory"
    status: done
  - title: "Ověřit výstup a zelený build"
    status: done
---

# Fáze 78 — report z auto session

## Co se povedlo

První díl překladu celého programu do angličtiny. Hotovo:

- **`src/cli.ts`** — přeloženy všechny `.description`, texty `.option`,
  validační/chybové hlášky (`parseMaxTurns`, `parseBumpLevel`, `ensurePushHasBump`,
  `requireOption`), potvrzovací message u `renumber` i všechny komentáře/JSDoc.
  Beze změny: názvy příkazů, flagy, `/mini:*` reference, cesty, identifikátory.
- **`src/ui/*`** — runtime řetězce i komentáře:
  - `ask.ts`: `Cancelled.`, `Field must not be empty.`
  - `streamRender.ts`: `Claude session started`, `<tool> failed` / `tool failed` + JSDoc
  - `usage.ts`: `tokens`, `from cache`, `in API`, `Stream summary` + JSDoc;
    `pluralTurns` zjednodušeno na `n === 1 ? 'turn' : 'turns'`
  - `interactive.ts`: JSDoc komentář
- **UI testy** — `streamRender.test.ts` a `usage.test.ts`: asserty na EN výstupy
  + přeloženy i české `it()` popisy. Fixtury simulující Claudův text
  (`Pracuji na tom` / `další řádek`) ponechány záměrně.
- **Meta soubory**:
  - `package.json` `description` → AJ (konzistentní s root popisem v `cli.ts`)
  - `CLAUDE.md` → nové pravidlo: program (UI, hlášky, logy, komentáře) je
    anglicky; česky zůstává jen tento soubor + chat a commity. Sekce „Jazyk
    programu" doplněna.
  - `docs/i18n-glossary.md` → přepsán zastaralý předpoklad (CLI/UI už není
    „zůstává česky"), přidána sekce „CLI help a UI hlášky" s kanonickými termíny,
    aktualizován „Stav migrace".

## Ověření (strojově, vše prošlo)

- `npm run build` — zelený (`tsc` + copy-assets).
- `npm test` — **651 testů / 50 souborů zelených**.
- `node dist/cli.js --help` i `done --help` — výstup čistě anglicky.
- Grep diakritiky v `src/cli.ts` + `src/ui/` — čistý (kromě záměrné fixtury
  `Pracuji na tom` v testu).

## Poznámky / otevřené

- Globální `mini` (instalovaný balíček) zůstává na 1.4.1 — anglické CLI/UI se do
  něj dostane až dalším vydáním (`done --push` s bumpem) a reinstalací. Stejná
  poznámka jako u předchozích překladových fází.
- Záměrně mimo tuto fázi (přijde dál dle glossary „Stav migrace"): runtime hlášky
  a komentáře v `src/commands/*`, reporty/memory (`state/*`, `writeMemory`),
  graph mappery (`graph/*`).
