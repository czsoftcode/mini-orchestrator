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
