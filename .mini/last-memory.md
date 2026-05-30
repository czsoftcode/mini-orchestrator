# Fáze 39 — Štíhlý last-memory v next

**Cíl:** mini:next (headless next.ts i session context.ts) vloží místo celého last-memory.md jen krátké shrnutí poslední fáze — hlavička, cíl, kroky a sekce 'na co dát pozor' — bez doslovných diskuzních poznámek a plného run reportu; ověřitelné unit testem extrakce a měřitelným poklesem next v .mini/token-report.md.

## Kroky
- [hotovo] Čistá funkce summarizeMemoryForNext(md) v src/commands/writeMemory.ts (vedle buildPhaseMemoryMarkdown): ponechá vše před '## Diskuse' (hlavička, cíl, kroky, poznámka, auto-commit), z bloku Diskuse vytáhne '## Pozor na', z bloku Run report sekci dle /pozor|nález|další fáz/i; bez kotev fallback tvrdým limitem délky (laditelné konstanty). Ověřitelné: npm run typecheck zelený, funkce exportovaná.
- [hotovo] Přepis updateLastMemoryLink: místo symlinku/kopie archivu přečte právě zapsaný archivní soubor, prožene summarizeMemoryForNext a zapíše malý regulérní last-memory.md (odpadá symlink i copy fallback, starý soubor se před zápisem smaže, selhání zůstává jen log.dim). Ověřitelné: po writePhaseMemory je last-memory.md malý a obsahuje pozor/nález, archiv memory/phase-*.md zůstává plný.
- [hotovo] Unit test summarizeMemoryForNext nad FIXNÍM vstupem (výstup buildPhaseMemoryMarkdown se vším): asserty ponechané sekce přítomné, pozor/nález vytažené, '## Záměr'/'## Klíčová rozhodnutí'/mechanické ověření pryč; zvlášť test fallbacku (vstup bez kotev delší než limit → ořez na limit). Ověřitelné: npm test zelené, nové testy.
- [hotovo] Brána + měření: npm run typecheck, npm run build, npm test zelené; npm run measure-tokens proběhne a next v .mini/token-report.md znatelně klesne oproti 1583 (buildery i measure.ts beze změny, pokles přijde díky menšímu last-memory.md). Ověřitelné: report přegenerován, next nižší.

## Auto-commit
- Fáze 39: Štíhlý last-memory v next (`900437965b59817bba85a5aed4f82805af3eec69`)

## Pozor na
- **Vnořené nadpisy:** Diskuse i Run report mají vlastní `#`/`##` nadpisy na stejné
  úrovni jako kotvy koláže — NELZE naivně splitovat podle `## `. Spolehlivé je
  slicovat podle literálních kotev `## Diskuse` / `## Run report` z producenta.
- **Run report má volné názvy sekcí** (píše je Claude) — `## Pozor na` z discuss je
  fixní, ale „nález" v run reportu se může jmenovat různě → matchovat sadou vzorů,
  a když nic nesedí, blok jen nepřispěje (globální pojistka limitem zůstává).
- **Token report nepřipínat na konkrétní číslo:** dnes `next` = 1583 tok, ale závisí
  na obsahu repa. Akceptační kritérium formulovat jako „next znatelně klesl oproti
  hodnotě před fází" / „podíl bloku last-memory v rozpadu next výrazně menší".
- **Symlink → soubor:** dnes je `last-memory.md` symlink (s copy fallbackem na
  Windows). Nově to bude regulérní zapsaný soubor — `updateLastMemoryLink` přestane
  symlinkovat, takže odpadá i copy fallback. Hlídat: před zápisem smazat starý
  `last-memory.md` (může to být starý symlink). Memory zůstává nice-to-have:
  selhání zápisu jen `log.dim`, workflow nepadá.
- **Unit test extrakce** dělat nad FIXNÍM vstupem (výstup `buildPhaseMemoryMarkdown`
  se vším), ne nad reálným stavem repa. Snapshoty next builderů se NEMĚNÍ (varianta B).
- **Brána:** `npm run typecheck`, `npm run build`, `npm test` zelené;
  `npm run measure-tokens` proběhne a `next` v reportu klesne.

## Pozor / poznámky pro člověka

- **Incident během měření, vyřešeno:** `last-memory.md` byl ještě starý **symlink**
  na archiv fáze 38. První pokus přegenerovat shrnutí zapsal přes symlink a tím
  zkrátil i archiv. Archiv jsem obnovil byte-identicky rekonstrukcí přes
  `buildPhaseMemoryMarkdown` ze stále existujících `discuss/phase-38.md`,
  `run/phase-38.md` a `phases/phase-038.json` (ověřeno: zpět na původních 12404 B).
  `last-memory.md` je teď regulérní soubor — git ukáže změnu typu symlink→soubor.
- Reálný zápis nové paměti (`writePhaseMemory`) se spustí až při příštím
  `mini done` — viz bod ve `verify`.
- Nález pro DALŠÍ fázi: `next` teď táhne nahoru hlavně **verbose Kroky** v hlavě
  shrnutí (každý krok nese dlouhý „Ověřitelné" text) — kandidát na další zeštíhlení
  (zkrátit/odstranit „Ověřitelné" část kroků v paměti). A `auto`/`plan`/`do` jsou
  teď dražší než `next` kvůli diskuzním poznámkám (71 %) a krokům (22 %).
