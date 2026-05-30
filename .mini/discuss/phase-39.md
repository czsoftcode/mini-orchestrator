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
