# Fáze 14 — Mapování projektu do grafu znalostí

## Co se udělalo

- **`src/graph/types.ts`** — typy `FileGraph`, `ExportInfo`, `ImportInfo`
- **`src/graph/mapper.ts`** — `mapFile()` nad `typescript` Compiler API (bez ts-morph); extrahuje exporty (`function`/`class`/`interface`/`type`/`enum`/`const`/`variable`/`export default`/`export {…} from`), importy (named, namespace, default, type-only, side-effect) a signatury veřejných metod tříd
- **`src/graph/buildGraph.ts`** — `buildGraph(cwd)`, `renderGraphMarkdown()`, `isTypeScriptProject()`, konstanta `GRAPH_FILE`; ignoruje `node_modules`, `dist`, `build`, `.mini`, `.git`, `.planning`, `.next`, `.turbo`, `.cache`, `coverage` a skryté adresáře; výstup deterministický (abecední řazení, unix-slash)
- **`src/commands/map.ts`** + registrace v `src/cli.ts` — příkaz `mini map`; pro non-TS projekty vypíše hint na `/graphify`
- **`src/prompts/nextPhase.ts`** — přepnutí na options-object signaturu (string backward-compat zachován); pokud `.mini/graph.md` existuje a není prázdný, vloží blok `# Mapa projektu` před sekci s nápadem uživatele
- **`src/commands/next.ts`** — načítá `.mini/graph.md` a tiše přeskočí, když soubor není
- **`src/commands/done.ts`** — `finalizePhaseSideEffects` volá `regenerateGraph(cwd)` jako třetí side-effect (po commitu a memory záznamu); best-effort, chyba = `log.warn`, workflow pokračuje
- **Testy**: 27 nových (mapper 11, buildGraph 7, map 3, nextPhase 4, done 2); snapshot pro `renderGraphMarkdown`; celkem 237 src testů prochází, typecheck čistý, build čistý
- **`package.json`** — `typescript` přesunut z `devDependencies` do `dependencies` (runtime potřeba)

## Klíčová rozhodnutí

- **Vlastní TS mapper místo ts-morph** — ts-morph by přidal ~5 MB runtime závislost; `typescript` Compiler API stačí a bylo již přítomno v `node_modules` jako dev dep; přesunuto do runtime deps
- **Jen textová syntaxe typů v signaturách** — žádný typový resolver; odpovídá zadání (žádný call-graph), signatura je čtená přímo z textové anotace
- **graphify jako pouhý hint, ne integrace** — graphify není čistá CLI binárka, spouští se jako Claude Code skill; plnohodnotná neinteraktivní integrace neprozkoumaná, proto jen textový hint v `mini map` výstupu
- **Graf verzován v gitu** (`.mini/graph.md`) — konzistentní s tím, jak je verzován `codebase.md` a `state.json`; lze přidat do `.gitignore` pokud se ukáže jako šum v diff
- **Bez nového memory scope pro graph** — vlastní mapper nevolá Claude, `resolveModel` netřeba
- **Bez inkrementální regenerace** — full rebuild celého mini repa < 1 s (61 souborů, 693 řádek); cache mtime/SHA zatím přínos nemá

## Otevřené konce

- **Token rozpočet grafu**: pro mini 693 řádek OK; až přeleze ~5–10k tokenů (větší projekty), bude potřeba injektovat jen relevantní sekci nebo summary — v `buildNextPhasePrompt` zatím žádný limit
- **Duplicita testů v `dist/`**: `vitest run` defaultně bere i `dist/*.test.js`; workaround byl smazat `dist/**/*.test.*` po buildu; trvalé řešení = `vitest.config.ts` s `exclude: ['dist/**']` (mimo scope fáze)
- **graphify fallback**: jak se graphify pouští neinteraktivně nebylo prověřeno; plnohodnotná integrace je otevřená jako budoucí fáze
- **Mappery pro jiné jazyky** (Rust, PHP…): explicitně odloženo do budoucích fází
