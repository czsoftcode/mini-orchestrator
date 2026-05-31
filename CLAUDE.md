# Instrukce pro Claude Code v tomto projektu

## Jazyk komunikace

**Komunikuj se mnou v češtině, ne v angličtině.** Týká se to:

- všech odpovědí v chatu (vysvětlení, otázky, shrnutí)
- commit messages

## Jazyk programu

**Vše uvnitř programu je anglicky** — nástroj má být mezinárodní a veřejně k
dispozici. Anglicky tedy piš:

- UI texty, CLI help, výstupy a logy příkazů
- chybové hlášky
- komentáře a JSDoc v kódu
- **projektovou dokumentaci** (`README.md`, `CHANGELOG.md`) — včetně **nových
  zápisků do `CHANGELOG.md`** (záznamy fází přes `/mini:done` piš anglicky)

Česky zůstává **jen** tento `CLAUDE.md` a naše komunikace v chatu + commit
messages (viz výše).

> Pozn.: Část kódu může být ještě česky — překlad probíhá postupně po fázích.
> Když nějaký český text v programu potkáš, přelož ho do angličtiny.

Beze změny (nepřekládá se):

- identifikátory v kódu (názvy funkcí, proměnných, typů, soubory)
- standardní technické termíny (`Promise`, `snapshot test`, `parser`, …)
- citace cizích chybových hlášek a výstupů nástrojů
- response-kontrakt parserů (`TITLE:`, `GOAL:`, `STEP:`, …) a stavová slova
  (`done`/`doing`/`todo`/…)
