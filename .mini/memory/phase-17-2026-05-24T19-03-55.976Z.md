# Fáze 17 — Paměť fáze bez Claude API

## Co se udělalo

- `src/commands/writeMemory.ts`: přepsaný `writePhaseMemory` — ve výchozím stavu generuje memory soubor přímo v TypeScriptu bez Claude API.
- Nová exportovaná funkce `buildPhaseMemoryMarkdown(phase, discussContent, runContent)` — skládá markdown jako koláž (nadpis, cíl, kroky s českými statusy přes `STEP_WORD`, humanNotes, autoCommit, discuss, run report); volitelné sekce se vynechají, když nejsou data.
- Nový helper `readFileOrEmpty(path)` — při neexistenci souboru vrací prázdný string místo výjimky.
- Logika Claude režimu vyčleněna do privátní funkce `writeViaClaude(...)` vracející `boolean`; volá se jen když `state.models?.memory != null`.
- `updateLastMemoryLink` zůstal beze změny, volá se v obou větvích.
- Přidán `src/commands/writeMemory.test.ts` — 3 testy na `buildPhaseMemoryMarkdown` (plná fáze, doslovné vložení discuss/run, vynechání prázdných sekcí); 262/262 zelených.

## Klíčová rozhodnutí

- **`state.models?.memory != null` místo `resolveModel('memory', state)`**: `resolveModel` padá na default model a volal by Claude i bez explicitního záměru uživatele. Přímá podmínka na explicitní nastavení je správná — bylo to klíčové upozornění v discuss.
- **Koláž místo syntézy**: výstup je delší a syrovější než claudovská verze, ale zadarmo a okamžitý. Záměrný kompromis — memory je nice-to-have.
- **Krok "smazat nepoužívané konstanty" odložen (skipped)**: `MEMORY_ALLOWED_TOOLS`, `MEMORY_TIMEOUT_MS` a `buildWriteMemoryPrompt` se pořád používají v `writeViaClaude`. Podmínka "pokud se nepoužívají" nenastala, mazat je nelze.
- **`buildPhaseMemoryMarkdown` exportovaná**: umožňuje unit testování bez souborového systému; Claude cesta (`writeViaClaude`) testovaná není — je to thin wrapper nad `askClaude`.

## Otevřené konce

- Stale snapshot `dist/graph/buildGraph.test.js` způsobuje 1 selhání při `vitest run` bez scopu (nesouvisí s touto fází, existuje od fáze 14/16). Řešení: přidat `dist` do vitest `exclude` nebo smazat `dist/` před testy.
- Claude cesta (`writeViaClaude`) nemá testy — pokrytí závisí na manuálním ověření s nastaveným `memory` scope.
- Prompt `buildWriteMemoryPrompt` zůstal beze změny, ale pokud by se Claude cesta kdy rušila úplně, šlo by smazat i `MEMORY_ALLOWED_TOOLS`, `MEMORY_TIMEOUT_MS` a tento import.
