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

## Co se NEpřekládá

- **Response-kontrakt** parsovaný parsery: `TITLE:`, `GOAL:`, `STEP:` — zůstává
  beze změny (parsery na něj spoléhají).
- Identifikátory v kódu (názvy funkcí, typů, klíčů stavu jako `done`/`doing`).

## Známé švy migrace (zatím nepřeloženo)

- `GRAPH_USAGE_HINT` (`src/prompts/graphHint.ts`) — sdílený mezi více prompty,
  jeho překlad patří do pozdější fáze. Do té doby přeložené prompty obsahují
  český blok s nápovědou ke grafu.
