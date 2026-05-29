# Fáze 27 — mini příkazi přímo v claude

## Záměr
Umožnit spouštět workflow mini přímo z Claude Code přes custom slash commandy
(`/`), aniž by se uvnitř session spouštěl vnořený Claude. Cílem je, aby celý cyklus
`next → discuss → plan → do → done` šel projet v jedné Claude session.

CLI `mini ...` přes Bash zůstává beze změny — slash commandy jsou doplněk, ne náhrada.

Rozsah fáze 27: commandy `/mini:next`, `/mini:discuss`, `/mini:plan`, `/mini:do`,
`/mini:done`. `/mini:auto` (řetěz plan → (do)* → done) se nechává na pozdější fázi.

## Klíčová rozhodnutí
- **Namespace `/mini:`** — soubory v `.claude/commands/mini/` (`next.md`, `discuss.md`,
  `plan.md`, `do.md`, `done.md`). Dvojtečka odděluje namespace od názvu; drží mini
  commandy pohromadě a brání kolizím.
- **Tenké tělo .md** — markdown command sám nedrží zmrazený prompt; volá pomocný
  mini pod-příkaz (typ `mini context <cmd>`), který vypíše vždy aktuální prompt/kontext.
  Prompty tak zůstávají na jednom místě v mini a nezastarají.
- **Stav drží mini (varianta b)** — agentní práci dělá Claude v aktuální session, ale
  stavové operace (`.mini/state.json`, run reporty, posun fáze, uložení kroků, uložení
  nové fáze) provádějí **neinteraktivní** mini pod-příkazy volané přes Bash. Stav tak
  zůstává v otestovaném TS, ne ve volném promptu.
- **Instalace přes `mini install-commands`** — nový příkaz vygeneruje
  `.claude/commands/mini/*.md` do cílového projektu; má jít pustit opakovaně (aktualizace).
- **Bez vnořeného Claude** — nativní commandy neběží jako `Claude → mini → Claude`.

## Pozor na
- **Existující `plan`/`do`/`done`/`next` jsou interaktivní a samy spouští Claude** —
  pro volání z Bash uvnitř session se nehodí. Bude třeba doplnit neinteraktivní
  pod-příkazy (nové subcommandy nebo flag typu `--apply`), které jen čtou/zapisují stav:
  načtení kontextu fáze (project.md + aktuální fáze + discuss poznámky), uložení kroků
  z plánu, označení kroku + zápis run reportu, posun fáze, uložení nové fáze z `next`.
  Část logiky lze využít: `advanceToNextPhase`, `buildPhaseCommitMessage`,
  `state/runReport.ts`, `buildDiscussPhasePrompt`/`buildPlanPhasePrompt`/atd.
- **Commandy patří do cílového projektu, ne do repa mini** — `.claude/commands/mini/`
  toho projektu, kde uživatel pracuje s Claude Code. Proto je nutná instalace.
- **Lidská verifikace v `done`** — v session se vyřeší přirozeně dotazem v chatu;
  posun stavu pak udělá pod-příkaz.
- **`next` je vstupní bod** cyklu (ještě neexistuje aktuální fáze) — to návrhu nevadí.
- Nový přístup; lze stavět po částech (auto a případné další commandy v dalších fázích).
