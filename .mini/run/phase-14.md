---
phase: 14
verdict: done
steps:
  - title: "TS mapper extrahuje exporty, importy, signatury z fixture souboru"
    status: done
  - title: "buildGraph.ts zapíše .mini/graph.md ze zdrojových souborů projektu"
    status: done
  - title: "`mini map` příkaz v CLI spustí regeneraci a vypíše počet souborů"
    status: done
  - title: "buildNextPhasePrompt vloží blok s grafem pokud .mini/graph.md existuje"
    status: done
  - title: "finalizePhaseSideEffects volá regeneraci grafu po auto-commitu"
    status: done
---

# Fáze 14 — report z auto session

## Co se povedlo

- **Vlastní TS-only mapper** (`src/graph/mapper.ts`) postavený přímo na
  `typescript` Compiler API (`ts.createSourceFile`). Žádný `ts-morph`, žádná
  další runtime závislost — `typescript` (5.9 z `node_modules`) jsem přesunul
  z `devDependencies` do `dependencies`, protože ho teď potřebuje runtime
  `dist/`. Mapper umí exporty (`function`/`class`/`interface`/`type`/`enum`/
  `const`/`variable`), `export default`, `export { ... } from`, type-only
  importy, namespace importy, default importy, side-effect importy a public
  metody tříd (privátní vynechává). Pro tělo funkcí a JSDoc se nesahá. Typy
  v signaturách jsou textová syntaxe z anotace (žádný typový resolver), což
  je záměrné — odpovídá zadání („žádné call-graph").

- **`buildGraph.ts`** (`src/graph/buildGraph.ts`) prochází projekt rekurzivně,
  ignoruje `node_modules`, `dist`, `build`, `.git`, `.mini`, `.planning`,
  `.next`, `.turbo`, `.cache`, `coverage` atd. Skryté soubory/adresáře pomíjí.
  `.d.ts` se ignoruje (čistě typové deklarace). Markdown renderer dává jednu
  `## src/…` sekci na soubor; uvnitř `Imports:` a `Exports:` bullety. Cesty
  jsou unix-slash (testovací stabilita napříč platformami). Soubory se třídí
  abecedně, výstup je deterministický.

- **`mini map`** registrovaný v `src/cli.ts` + `src/commands/map.ts`. Detekuje
  TS projekt (`tsconfig.json` nebo `.ts`/`.tsx` v projektu); pro non-TS
  projekty radí `/graphify` v Claude session, jak diskuse navrhovala. Ostrý
  běh nad mini repem: 61 souborů, 693 řádek grafu, < 1 s.

- **`buildNextPhasePrompt`** přepnut na options-object signaturu se
  zachováním backward-compat string verze (`userHint` jako 3. argument
  funguje dál — existující testy potvrzují). Nově přijímá `graphMd`. Pokud
  je předán a není prázdný, blok `# Mapa projektu` se vloží před `# Nápad
  uživatele` v promptu. `commands/next.ts` graf načítá z `.mini/graph.md`
  a tiše ignoruje, když soubor není.

- **`finalizePhaseSideEffects`** v `done.ts` nově volá `regenerateGraph(cwd)`
  jako třetí side-effect (po commitu a memory záznamu). Best-effort: pro
  non-TS projekty tiše přeskočí, při chybě jenom `log.warn`, workflow
  pokračuje. Memory pro graph scope **není zaveden** — vlastní mapper
  neběží přes Claude, takže `resolveModel` netřeba.

- **Pokrytí testy**: 27 nových testů (mapper 11, buildGraph 7, map 3,
  nextPhase 4, done 2). Snapshot pro `renderGraphMarkdown` zaveden. Všech
  237 src testů projde, typecheck čistý, build čistý.

## Cestou opravené nebo zarazitelné

- **Duplicita testů v `dist/`**: `vitest run` defaultně bere i `dist/*.test.js`
  z předchozích buildů. Smazal jsem `dist/**/*.test.*` po finálním buildu;
  jako trvalé řešení by stálo přidat `vitest.config.ts` s `include: ['src/**/*.test.ts']`
  nebo `exclude: ['dist/**']` — mimo scope této fáze.

- **`.gitignore` pro `.mini/graph.md`**: neřešil jsem. Současný pattern
  v `.mini/` (state.json, codebase.md, memory/) je verzovat, takže graf
  taky držím verzovaný. Kdyby se ukázal jako šum v diffu, stačí přidat
  pattern `/.mini/graph.md` do `.gitignore`.

## Otevřené otázky / co stojí za zvážení později

- **Token rozpočet grafu**. Pro mini je 693 řádek v pohodě. Až graf přeleze
  ~5-10k tokenů (větší projekt), bude vhodné v `next` injektovat jen sekci
  nebo summary (otevřeno, jak v zadání).

- **Inkrementální regenerace** zatím nutná není — `mini map` na celém mini
  repu trvá zlomek sekundy. Cache mtime/SHA by stála za to teprve u
  desetitisíců souborů.

- **graphify fallback** je zatím jen hint v `mini map` výstupu (zadání to
  takhle připouštělo). Plnohodnotná integrace by chtěla ověřit, jak se
  graphify pouští neinteraktivně — to jsem nezkoumal.

## Soubory přidané v této fázi
- `src/graph/types.ts` — typy `FileGraph`, `ExportInfo`, `ImportInfo` a spol.
- `src/graph/mapper.ts` — `mapFile(content, relPath)` nad TS Compiler API
- `src/graph/buildGraph.ts` — `buildGraph(cwd)`, `isTypeScriptProject(cwd)`,
  `renderGraphMarkdown(files)`, konstanta `GRAPH_FILE`
- `src/graph/mapper.test.ts`, `src/graph/buildGraph.test.ts`,
  `src/graph/__snapshots__/buildGraph.test.ts.snap`
- `src/commands/map.ts`, `src/commands/map.test.ts`

## Soubory upravené
- `package.json` — `typescript` z dev → runtime dependencies
- `src/cli.ts` — registrace `mini map`
- `src/commands/next.ts` — načtení `.mini/graph.md` a předání do promptu
- `src/commands/done.ts` — `finalizePhaseSideEffects` volá `regenerateGraph`
- `src/prompts/nextPhase.ts` — options-object signatura + `# Mapa projektu` blok
- `src/prompts/nextPhase.test.ts` — testy pro options API a graphMd blok
- `src/commands/done.test.ts` — testy pro graph regeneraci v `done({ auto: true })`
