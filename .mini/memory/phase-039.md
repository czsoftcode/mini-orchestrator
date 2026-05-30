# Fáze 39 — Štíhlý last-memory v next

**Cíl:** mini:next (headless next.ts i session context.ts) vloží místo celého last-memory.md jen krátké shrnutí poslední fáze — hlavička, cíl, kroky a sekce 'na co dát pozor' — bez doslovných diskuzních poznámek a plného run reportu; ověřitelné unit testem extrakce a měřitelným poklesem next v .mini/token-report.md.

## Kroky
- [hotovo] Čistá funkce summarizeMemoryForNext(md) v src/commands/writeMemory.ts (vedle buildPhaseMemoryMarkdown): ponechá vše před '## Diskuse' (hlavička, cíl, kroky, poznámka, auto-commit), z bloku Diskuse vytáhne '## Pozor na', z bloku Run report sekci dle /pozor|nález|další fáz/i; bez kotev fallback tvrdým limitem délky (laditelné konstanty). Ověřitelné: npm run typecheck zelený, funkce exportovaná.
- [hotovo] Přepis updateLastMemoryLink: místo symlinku/kopie archivu přečte právě zapsaný archivní soubor, prožene summarizeMemoryForNext a zapíše malý regulérní last-memory.md (odpadá symlink i copy fallback, starý soubor se před zápisem smaže, selhání zůstává jen log.dim). Ověřitelné: po writePhaseMemory je last-memory.md malý a obsahuje pozor/nález, archiv memory/phase-*.md zůstává plný.
- [hotovo] Unit test summarizeMemoryForNext nad FIXNÍM vstupem (výstup buildPhaseMemoryMarkdown se vším): asserty ponechané sekce přítomné, pozor/nález vytažené, '## Záměr'/'## Klíčová rozhodnutí'/mechanické ověření pryč; zvlášť test fallbacku (vstup bez kotev delší než limit → ořez na limit). Ověřitelné: npm test zelené, nové testy.
- [hotovo] Brána + měření: npm run typecheck, npm run build, npm test zelené; npm run measure-tokens proběhne a next v .mini/token-report.md znatelně klesne oproti 1583 (buildery i measure.ts beze změny, pokles přijde díky menšímu last-memory.md). Ověřitelné: report přegenerován, next nižší.

## Auto-commit
- Fáze 39: Štíhlý last-memory v next (`900437965b59817bba85a5aed4f82805af3eec69`)

## Diskuse
# Fáze 39 — Štíhlý last-memory v next

## Záměr
`mini:next` dnes vkládá do promptu **celý** `.mini/last-memory.md` (blok
„# Poslední fáze") — to je ~63 % token ceny next promptu (viz token-report fáze 38).
Cílem je vkládat jen krátké, relevantní shrnutí poslední fáze místo plné koláže.

`last-memory.md` vzniká v `buildPhaseMemoryMarkdown` (src/commands/writeMemory.ts)
jako koláž s pevnou strukturou:
`# Fáze N — titul` / `**Cíl:**` / `## Kroky` / `## Poznámka uživatele` (volit.) /
`## Auto-commit` / `## Diskuse` (celý discuss verbatim) / `## Run report`
(celý run report verbatim). Discuss má vlastní fixní pod-sekce
(`## Záměr`, `## Klíčová rozhodnutí`, `## Pozor na` — viz discussPhase.ts).

Vkládají ho DVA buildery identickým kódem (blok „# Poslední fáze"):
- headless `buildNextPhasePrompt` (src/prompts/nextPhase.ts) — pro `mini next`
- session `buildNextSessionPrompt` (src/prompts/sessionContext.ts) — pro `/mini:next`

Dnes je `last-memory.md` symlink/kopie plné archivní koláže
(`.mini/memory/phase-{id}-{datum}.md`), vytváří ho `updateLastMemoryLink`
ve writeMemory.ts. Čte ho JEDINĚ `next` (readLastMemoryIfExists v next.ts i context.ts).

## Klíčová rozhodnutí
- **Co ponechat (rozhodnuto s uživatelem):** hlavička + `**Cíl:**` + `## Kroky` +
  `## Poznámka uživatele` + `## Auto-commit`, a navíc **vytáhnout „pozor/nález"
  sekce**: z bloku Diskuse fixní `## Pozor na`, z bloku Run report sekci, jejíž
  nadpis matchuje `/pozor|nález|další fáz/i`. Zahodit `## Záměr`,
  `## Klíčová rozhodnutí` a mechanické kroky/ověření z run reportu. Důvod:
  „pozor/nález" je pro návrh další fáze nejcennější signál (fázi 39 zrodil řádek
  „Nález pro další fázi (co zmenšit)" z reportu fáze 38), kdežto Záměr/rozhodnutí
  jsou už realizované a kroky jsou i v historii fází.
- **Kde ořez aplikovat (ROZHODNUTO — varianta B, write-time):** zeštíhlení se děje
  při ZÁPISU. Archiv `.mini/memory/phase-{id}-{datum}.md` zůstává PLNÝ (trvalý
  záznam), ale `.mini/last-memory.md` se nově generuje jako MALÝ shrnutý soubor
  (už ne symlink/kopie). `updateLastMemoryLink` se přepíše: přečte právě zapsaný
  archiv, prožene ho `summarizeMemoryForNext` a zapíše výsledek do `last-memory.md`
  (regulérní soubor). Funguje to jednotně pro TS i claude-mode větev (čte se
  hotový archivní soubor z disku).
- **Co se NEMĚNÍ:** buildery `buildNextPhasePrompt` / `buildNextSessionPrompt`
  zůstávají beze změny (vkládají obsah `last-memory.md` tak jak je — teď už malý),
  takže jejich snapshot testy se nemění. `src/tokens/measure.ts` se nemění — runner
  čte už zeštíhlený `last-memory.md` z disku, takže pokles v `.mini/token-report.md`
  přijde sám. next.ts/context.ts se nemění.
- **Extrakce přes známé kotvy:** čistá funkce `summarizeMemoryForNext(md)` umístit
  PŘÍMO ve `src/commands/writeMemory.ts` vedle `buildPhaseMemoryMarkdown` — kotvy
  (`\n## Diskuse`, `\n## Run report`) tam producent emituje o pár řádků výš, takže
  žádný riziko driftu a žádný cross-layer import. Slicovat podle těch literálů,
  uvnitř bloků hledat pod-nadpisy regexem.
- **Fallback tvrdým limitem (rozhodnuto):** když očekávané kotvy chybí
  (claude-mode paměť píše Claude volně), ořezat aspoň na rozumný limit délky
  (laditelná konstanta, např. ~40 řádků / ~1500 znaků), ať ani neznámý formát
  prompt nenafoukne.

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

## Run report
---
phase: 39
verdict: done
steps:
  - title: "Čistá funkce summarizeMemoryForNext(md) v src/commands/writeMemory.ts (vedle buildPhaseMemoryMarkdown): ponechá vše před '## Diskuse' (hlavička, cíl, kroky, poznámka, auto-commit), z bloku Diskuse vytáhne '## Pozor na', z bloku Run report sekci dle /pozor|nález|další fáz/i; bez kotev fallback tvrdým limitem délky (laditelné konstanty). Ověřitelné: npm run typecheck zelený, funkce exportovaná."
    status: done
  - title: "Přepis updateLastMemoryLink: místo symlinku/kopie archivu přečte právě zapsaný archivní soubor, prožene summarizeMemoryForNext a zapíše malý regulérní last-memory.md (odpadá symlink i copy fallback, starý soubor se před zápisem smaže, selhání zůstává jen log.dim). Ověřitelné: po writePhaseMemory je last-memory.md malý a obsahuje pozor/nález, archiv memory/phase-*.md zůstává plný."
    status: done
  - title: "Unit test summarizeMemoryForNext nad FIXNÍM vstupem (výstup buildPhaseMemoryMarkdown se vším): asserty ponechané sekce přítomné, pozor/nález vytažené, '## Záměr'/'## Klíčová rozhodnutí'/mechanické ověření pryč; zvlášť test fallbacku (vstup bez kotev delší než limit → ořez na limit). Ověřitelné: npm test zelené, nové testy."
    status: done
  - title: "Brána + měření: npm run typecheck, npm run build, npm test zelené; npm run measure-tokens proběhne a next v .mini/token-report.md znatelně klesne oproti 1583 (buildery i measure.ts beze změny, pokles přijde díky menšímu last-memory.md). Ověřitelné: report přegenerován, next nižší."
    status: done
verify:
  - title: "Až proběhne příští `mini done`, zkontrolovat, že nově vzniklý .mini/last-memory.md je regulérní malý soubor se shrnutím (hlavička, cíl, kroky, auto-commit, Pozor na, Nález) — ne symlink na plný archiv."
    detail: "Ověřeno strojově nad rekonstruovaným archivem fáze 38 (summarizeMemoryForNext dává správné sekce), ale reálný zápis přes writePhaseMemory se spustí až při dalším mini done — to jsem v této session nespouštěl."
---

# Fáze 39 — report z auto session

Cíl splněn: `mini:next` už nedostává celý `last-memory.md`, ale jeho krátké
shrnutí. Zeštíhlení se děje při ZÁPISU paměti (varianta B), buildery `next` ani
`measure.ts` se neměnily — jen čtou menší soubor.

## Co se udělalo

- **`summarizeMemoryForNext(md)`** v `src/commands/writeMemory.ts` (vedle
  `buildPhaseMemoryMarkdown`): z plné memory koláže vyrobí shrnutí — ponechá hlavu
  (hlavička, **Cíl**, **Kroky**, Poznámka uživatele, Auto-commit) a navíc vytáhne
  to nejcennější pro návrh další fáze: `## Pozor na` z bloku Diskuse a sekci
  „nález / další fáze" z bloku Run report (volné názvy → regex
  `/pozor|nález|další fáz/i`). Doslovný Záměr, Klíčová rozhodnutí a mechanické
  Co-se-udělalo / Ověření vynechá.
- **Sdílené konstanty kotev** `DISCUSS_SECTION` / `RUN_REPORT_SECTION` — používá je
  producent i konzument, takže se názvy sekcí nemůžou rozejít. Slicuje se podle
  literálních kotev `## Diskuse` / `## Run report` (NE naivně podle `## `, protože
  oba bloky mají vlastní vnořené `##` nadpisy).
- **`writeLastMemorySummary`** (přejmenovaný `updateLastMemoryLink`): přečte právě
  zapsaný archiv, prožene `summarizeMemoryForNext` a zapíše malý **regulérní**
  `last-memory.md`. Symlink i copy fallback odpadly (zrušeny i nepoužité importy
  `symlink`/`copyFile`/`relative`). Archiv `memory/phase-*.md` zůstává plný.
- **6 nových testů** v `writeMemory.test.ts` nad fixním vstupem
  (`buildPhaseMemoryMarkdown` se vším): ponechané sekce, vytažení pozor/nález,
  zahození Záměru/rozhodnutí/mechanického ověření, kratší než plná koláž, fallback
  tvrdým limitem, krátká paměť bez kotev beze změny.

## Klíčové rozhodnutí během implementace

- **Tvrdý limit (2000 zn.) jen ve fallbacku, ne globálně.** Původně jsem cap
  aplikoval na celé shrnutí — jenže hlava s plným seznamem Kroků (každý krok má
  dlouhý „Ověřitelné: …" text) sama přesáhne 2000 znaků, takže globální ořez
  uřízl konec, tj. zrovna vytažené Pozor na / Nález (to nejcennější). Ve strukturní
  větvi proto NEkrátíme — hranicí je výběr sekcí; cap je pojistka jen pro paměť
  bez známých kotev (claude-mode).

## Ověření (strojově)

- `npm run typecheck` ✓, `npm run build` ✓, `npm test` ✓ — 36 souborů,
  **439 testů** (z toho 6 nových).
- `npm run measure-tokens` ✓ — `next` kleslo z **3679 → 1971 tok** (podíl bloku
  last-memory z 86 % na 71 %, absolutně zhruba na polovinu). `last-memory.md`
  z 12404 B → 4950 B. Pokles je měřitelný a zapsaný v `.mini/token-report.md`.
  (Pozn.: baseline 3679, ne 1583 z reportu fáze 38 — last-memory mezitím narostl.)

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
