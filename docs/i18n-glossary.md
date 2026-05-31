# Slovníček překladu instrukcí (CZ → EN)

Mini orchestrátor postupně překládá své interní instrukce (prompty v `src/prompts/`)
do angličtiny. Tento dokument drží **kanonické překlady termínů**, aby byly napříč
prompty konzistentní. Při překladu dalšího promptu se o něj opři a doplň ho, když
narazíš na nový termín.

> Pozn.: Komunikace s uživatelem v tomto repu zůstává česky (viz `CLAUDE.md`).
> Anglicky se píší **prompty pro Claude** (interní instrukce nástroje), ne chat ani commity.

## Termíny životního cyklu fáze

| Česky          | Anglicky        | Poznámka                                   |
| -------------- | --------------- | ------------------------------------------ |
| fáze           | phase           |                                            |
| krok           | step            |                                            |
| cíl            | goal            |                                            |
| projekt        | project         |                                            |
| návrh          | proposal        | u stavu fáze: `proposed`                   |

## Stavy (PHASE_WORD / STEP_WORD)

| Česky      | Anglicky      | Klíč stavu  |
| ---------- | ------------- | ----------- |
| hotovo     | done          | `done`      |
| dělá se    | in progress   | `doing`     |
| čeká       | todo          | `todo`      |
| odloženo   | skipped       | `skipped`   |
| plán       | planned       | `planned`   |
| návrh      | proposed      | `proposed`  |

## Nadpisy a fráze v promptech

| Česky                          | Anglicky                       |
| ------------------------------ | ------------------------------ |
| Tvůj úkol                      | Your task                      |
| Projekt                        | Project                        |
| Aktuální fáze                  | Current phase                  |
| Dosavadní postup               | Progress so far                |
| Postup                         | Progress                       |
| Poslední fáze                  | Last phase                     |
| Nápad uživatele                | User's idea                    |
| Poznámky k fázi (z diskuse)    | Phase notes (from discussion)  |
| Fáze, kterou rozmenujeme       | Phase to break down            |
| Kroky:                         | Steps:                         |
| ← pracuj na tomhle             | ← work on this                 |
| Jak postupovat                 | How to proceed                 |
| Smíš použít                    | You may use                    |
| Hotová fáze                    | Finished phase                 |
| Poznámka uživatele             | User's note                    |
| Opakovaný pokus (průchod N)    | Retry (iteration N)            |
| Průběžný zápis kroků           | Tracking step progress         |
| Report na konci session        | Report at the end of the session |
| report z auto session          | report from the auto session   |
| Fáze k diskusi                 | Phase to discuss               |
| Poznámky z diskuse             | Discussion notes               |
| diskusní session               | discussion session             |
| Nejdřív se zeptej              | Ask first                      |
| Fáze už má kroky               | The phase already has steps    |
| Report z implementace          | Implementation report          |
| Body k ručnímu ověření         | Items for manual verification  |
| Posun stavu                    | Moving the state               |
| Body z reportu k ověření       | Items from the report to verify |
| Kroky fáze                     | Phase steps                    |
| Po kontrole                    | After the review               |
| hloubková kontrola UI/UX       | in-depth UI/UX review          |
| zpětná hloubková kontrola      | retrospective in-depth review  |

### Sekce memory souboru (writeMemory) — nejsou parsované, volný překlad

| Česky                | Anglicky        |
| -------------------- | --------------- |
| Formát výstupu       | Output format   |
| Co se udělalo        | What was done   |
| Klíčová rozhodnutí   | Key decisions   |
| Otevřené konce       | Loose ends      |

### Sekce diskuzních poznámek (discuss) — `Watch out for` parsuje summarizer

Šablonu poznámek z diskuse píše Claude podle promptu `discussPhase`; sekci
„Watch out for" (a obdoby „findings/next phase" v run reportu) **parsuje**
`summarizeMemoryForNext` v `commands/writeMemory.ts` (matchery `pozor|watch out`,
resp. `finding|next phase|nález|další fáz` — drží i starší českou paměť). Kdo
přejmenuje tyhle nadpisy v promptu, musí upravit i matchery + jejich test.

| Česky                | Anglicky          |
| -------------------- | ----------------- |
| Záměr                | Intent            |
| Klíčová rozhodnutí   | Key decisions     |
| Pozor na             | Watch out for     |
| Nálezy z verify      | Verify findings   |

### Sekce `codebase.md` (audit) — nejsou parsované, volný překlad

| Česky                  | Anglicky            |
| ---------------------- | ------------------- |
| přehled kódu           | code overview       |
| Přehled                | Overview            |
| Adresářová struktura   | Directory structure |
| Klíčové moduly         | Key modules         |
| Technologie            | Technologies        |
| (neidentifikováno)     | (unidentified)      |

## Co se NEpřekládá

- **Response-kontrakt** parsovaný parsery: `TITLE:`, `GOAL:`, `STEP:` a u importu GSD
  `NAME:`, `WHAT:`, `FOR_WHOM:`, `CONSTRAINTS:`, `PHASES:` — zůstává beze změny
  (parsery na něj spoléhají).
- Stavová slova v `PHASES:` (`done`/`doing`/`todo`/`skipped`) a mapovací klíče
  cizích nástrojů (`completed`, `in_progress`, `pending`, `cancelled`, …).
- Identifikátory v kódu (názvy funkcí, typů, klíčů stavu jako `done`/`doing`).

## Stav migrace

Překlad promptů je **dokončen** (fáze 73–76) — všechny buildery v `src/prompts/`
generují anglické instrukce, sdílený `GRAPH_USAGE_HINT` včetně.

Záměrně **česky** zůstává interní produkce paměťové koláže
`buildPhaseMemoryMarkdown` v `commands/writeMemory.ts` (nadpisy `## Diskuse`,
`## Run report`, `## Kroky`, `## Poznámka uživatele`, `## Auto-commit`, `**Cíl:**`).
Není to prompt — je to skládání dat, která mini vlastní; konzument
`summarizeMemoryForNext` se na ty kotvy váže. Případný překlad je samostatná
změna mimo „překlad instrukcí".
