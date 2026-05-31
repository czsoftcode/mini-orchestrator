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
