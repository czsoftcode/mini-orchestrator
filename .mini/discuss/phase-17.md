# Fáze 17 — Paměť fáze bez Claude API

## Záměr
`writePhaseMemory` má generovat `.mini/memory/phase-{id}-{timestamp}.md` přímo v TypeScriptu bez volání Claude API. Místo syntézy sestaví soubor jako koláž dat, která mini už má k dispozici:
- metadata fáze z `Phase` objektu (id, title, goal, kroky + jejich statusy, humanNotes, autoCommit.subject + sha)
- obsah `.mini/discuss/phase-{id}.md` vložený doslova (pokud existuje)
- obsah `.mini/run/phase-{id}.md` vložený doslova (pokud existuje)

Výstup bude delší a "syrový" než claudovská syntéza, ale zadarmo a okamžitý.

Claude se zavolá **pouze** pokud je model scope `memory` explicitně nastaven (`state.models?.memory != null`) — ne pokud se jen dědí z `default`.

## Klíčová rozhodnutí
- Podmínka pro volání Claude: `state.models?.memory != null` (explicitní nastavení přes `mini model`), ne fallback na default model.
- Prompt pro Claude (`buildWriteMemoryPrompt`) zůstává beze změny — použije se jen v explicitním režimu.
- Logika `updateLastMemoryLink` (symlink / copyFile fallback na `last-memory.md`) se zachovává beze změny.
- Timestamp v názvu souboru zůstává (`phase-{id}-{timestamp}.md`).
- Soubor zapisuje mini přes `fs.writeFile` přímo, ne přes Claude s `Write` nástrojem.

## Pozor na
- `resolveModel('memory', state)` aktuálně padá na default — nesmí se použít pro rozhodnutí "volat / nevolat Claude". Použít přímou podmínku `state.models?.memory != null`.
- Discuss notes a run report se vkládají jako celý obsah souboru (ne výběr) — obsah může být dlouhý, to je v pořádku.
- Chybové cesty zůstávají stejné: memory je nice-to-have, selhání zapisuje jen warning a workflow pokračuje.
