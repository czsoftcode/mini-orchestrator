---
phase: 17
verdict: done
steps:
  - title: "Přečíst discuss a run soubory do řetězce (nebo prázdný string)"
    status: done
  - title: "Sestavit markdown z Phase objektu bez Claude (id, title, goal, kroky+statusy, humanNotes, autoCommit)"
    status: done
  - title: "Přidat discuss a run obsah jako sekce do markdown"
    status: done
  - title: "Zapsat soubor přes `fs.writeFile` místo `askClaude`"
    status: done
  - title: "Zachovat volání Claude pokud `state.models?.memory != null`"
    status: done
  - title: "Smazat `MEMORY_ALLOWED_TOOLS`, `MEMORY_TIMEOUT_MS` a import `buildWriteMemoryPrompt` pokud se nepoužívají"
    status: skipped
---

# Fáze 17 — report z auto session

## Co se povedlo
`writePhaseMemory` (`src/commands/writeMemory.ts`) je přepsaný. Ve výchozím stavu
generuje `.mini/memory/phase-{id}-{timestamp}.md` **přímo v TypeScriptu** bez
jakéhokoli volání Claude API — okamžitě a zadarmo.

- Nová čistá funkce `buildPhaseMemoryMarkdown(phase, discussContent, runContent)`
  složí soubor jako koláž: `# Fáze {id} — {title}`, `**Cíl:**`, sekce `## Kroky`
  (každý krok s českým statusem přes `STEP_WORD`), `## Poznámka uživatele`
  (humanNotes), `## Auto-commit` (`subject` + `sha`), `## Diskuse` a `## Run report`
  s doslovně vloženým obsahem příslušných souborů. Volitelné sekce se vynechají,
  když k nim nejsou data.
- Discuss a run report se čtou přes nový helper `readFileOrEmpty` (neexistuje →
  prázdný string, žádná výjimka).
- Zápis jde přes `fs.writeFile` přímo, ne přes Claude s `Write` nástrojem.
- `updateLastMemoryLink` (symlink / copyFile fallback) zůstal beze změny a volá se
  v obou režimech po úspěšném zápisu.

## Explicitní Claude režim
Claude se zavolá **jen** když `state.models?.memory != null` — tedy když uživatel
scope `memory` ručně nastavil přes `mini model`. Záměrně se nepoužívá
`resolveModel('memory', state)`, protože ten padá na default a volal by Claude i
bez explicitního přání. Tato cesta je vyčleněná do helperu `writeViaClaude(...)`,
který vrací `boolean` (vznikl soubor?) a používá `state.models?.memory` přímo jako
model. Prompt `buildWriteMemoryPrompt` zůstal beze změny.

## K poslednímu kroku (skipped)
`MEMORY_ALLOWED_TOOLS`, `MEMORY_TIMEOUT_MS` ani import `buildWriteMemoryPrompt`
jsem **nemazal** — pořád se používají v `writeViaClaude` pro explicitní Claude
režim, který krok 5 vyžaduje zachovat. Mazat by je šlo jen kdyby Claude cesta
zanikla úplně; podmínka "pokud se nepoužívají" tedy nenastala.

## Testy a ověření
- Přidán `src/commands/writeMemory.test.ts` (3 testy na `buildPhaseMemoryMarkdown`:
  plná fáze, doslovné vložení discuss/run, vynechání prázdných sekcí).
- `npm run typecheck` i `tsc` (build) projdou bez chyb.
- `vitest run src/` = 262/262 testů zelených, včetně beze změny `done.test.ts`,
  `auto.test.ts` a `prompts/writeMemory.test.ts`.

## Poznámka pro člověka
Plný `vitest run` (bez scopu) hlásí 1 selhání ve `dist/graph/buildGraph.test.js` —
je to **stale snapshot ve zkompilovaném `dist/`** (gitignorovaný build output z
fáze 14/16), který se rozjede s freshly buildnutým `.js`. Projekt nemá vitest
config, takže default sbírá i `dist/**/*.test.js`. Se zdrojovou `src` verzí
(`buildGraph.test.ts`) je vše v pořádku (9/9). S fází 17 to nesouvisí. Případně
stačí smazat `dist/` před spuštěním testů.
