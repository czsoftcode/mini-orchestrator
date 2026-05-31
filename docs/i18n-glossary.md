# Slovníček překladu (CZ → EN)

Mini orchestrátor se postupně překládá do angličtiny — nástroj má být
mezinárodní a veřejně k dispozici. **Vše uvnitř programu je anglicky**: prompty
pro Claude (`src/prompts/`), ale i CLI help, runtime hlášky, logy a komentáře.
Tento dokument drží **kanonické překlady termínů**, aby byly napříč kódem
konzistentní. Při překladu dalšího kusu se o něj opři a doplň ho, když narazíš na
nový termín.

> Pozn.: Česky zůstává **jen** `CLAUDE.md` a naše komunikace s uživatelem
> (chat + commit messages) — viz `CLAUDE.md`. Cokoli v programu se píše anglicky.

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

## CLI help a UI hlášky (cli.ts, ui/*)

Runtime vrstva, kterou uživatel vidí přes `mini --help` a při běhu příkazů
(fáze 78). Názvy příkazů, flagy (`--apply`, `--bump`, `--push`, …), `/mini:*`
reference a cesty zůstávají beze změny.

| Česky                          | Anglicky                              |
| ------------------------------ | ------------------------------------- |
| Zrušeno.                       | Cancelled.                            |
| Pole nesmí být prázdné.        | Field must not be empty.              |
| Chybí povinný parametr <flag>. | Missing required option <flag>.       |
| Musí to být celé kladné číslo. | Must be a positive integer.           |
| Při --push musíš zvolit úroveň verze | With --push you must choose a version level |
| Claude session spuštěna        | Claude session started                |
| <tool> selhal / nástroj selhal | <tool> failed / tool failed           |
| Souhrn streamu                 | Stream summary                        |
| tokenů                         | tokens                                |
| z cache                        | from cache                            |
| v API                          | in API                                |
| odpověď/odpovědi/odpovědí      | turn / turns (AJ má jen 2 tvary)      |
| Provést přečíslování a přejmenování souborů? | Perform the renumbering and file renaming? |

## Co se NEpřekládá

- **Response-kontrakt** parsovaný parsery: `TITLE:`, `GOAL:`, `STEP:` a u importu GSD
  `NAME:`, `WHAT:`, `FOR_WHOM:`, `CONSTRAINTS:`, `PHASES:` — zůstává beze změny
  (parsery na něj spoléhají).
- Stavová slova v `PHASES:` (`done`/`doing`/`todo`/`skipped`) a mapovací klíče
  cizích nástrojů (`completed`, `in_progress`, `pending`, `cancelled`, …).
- Identifikátory v kódu (názvy funkcí, typů, klíčů stavu jako `done`/`doing`).

### Slash-command `.md` (install-commands) — text pro Claude, přeložen

Popisy (`description:`) a těla commandů `.claude/commands/mini/*.md` se generují
z `src/commands/install-commands.ts`. Přeloženo do AJ vč. výchozí šablony těla.
Beze změny zůstávají: názvy příkazů a flagy (`mini context …`, `mini … --apply`,
`--max-phases`, `--yolo`, `--verify`, `--discuss`, `--step-done`), `$ARGUMENTS`,
`TITLE: -`, cesty (`.mini/STOP`, `.mini/run/`). Logy CLI v `installCommands`
(`Vytvořeno`/`Aktualizováno`/`Hotovo`/…) jsou zatím česky, ale jako součást
programu se přeloží do angličtiny v některé z dalších fází i18n.

| Česky                          | Anglicky                       |
| ------------------------------ | ------------------------------ |
| Postupuj v tomhle pořadí       | Proceed in this order          |
| autonomní režim                | autonomous mode                |
| Argumenty běhu                 | Run arguments                  |
| Cyklus jedné fáze              | The cycle of one phase         |
| Potvrzování příkazů            | Confirming commands            |
| Stop háčky                     | Stop hooks                     |
| Konec běhu                     | End of run                     |
| přeskoč                        | skip                           |
| podmíněně                      | conditionally                  |
| mezi kroky cyklu               | between cycle steps            |

## Stav migrace

Překlad promptů je **dokončen** (fáze 73–77) — všechny buildery v `src/prompts/`
generují anglické instrukce (sdílený `GRAPH_USAGE_HINT` včetně) a slash-command
`.md` jsou anglicky.

Překlad **programu** (CLI + UI + komentáře) běží od fáze 78:
- **hotovo (fáze 78):** `src/cli.ts` a `src/ui/*` (runtime hlášky i komentáře),
  `package.json` description, jazykové pravidlo v `CLAUDE.md`.
- **zbývá:** runtime hlášky a komentáře v `src/commands/*`, reporty/memory
  (`src/state/*`, `commands/writeMemory.ts`), graph mappery (`src/graph/*`) a
  další moduly.

Záměrně **česky** zůstává interní produkce paměťové koláže
`buildPhaseMemoryMarkdown` v `commands/writeMemory.ts` (nadpisy `## Diskuse`,
`## Run report`, `## Kroky`, `## Poznámka uživatele`, `## Auto-commit`, `**Cíl:**`).
Není to prompt — je to skládání dat, která mini vlastní; konzument
`summarizeMemoryForNext` se na ty kotvy váže. Případný překlad je samostatná
změna mimo „překlad instrukcí".
