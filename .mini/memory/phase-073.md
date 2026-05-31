# Fáze 73 — Překlad lifecycle promptů do AJ

**Cíl:** Přeložit do angličtiny tři klíčové prompty životního cyklu fáze (nextPhase.ts, planPhase.ts, doPhase.ts) a aktualizovat jejich snapshot testy; u toho ustálit česko-anglický slovníček termínů (fáze→phase, krok→step, cíl→goal), o který se opřou další fáze překladu.

## Kroky
- [hotovo] Slovníček CZ→EN
- [hotovo] nextPhase.ts → AJ
- [hotovo] planPhase.ts → AJ
- [hotovo] doPhase.ts → AJ
- [hotovo] Přegenerovat snapshoty a ověřit

## Auto-commit
- Fáze 73: Překlad lifecycle promptů do AJ

## Run report
---
phase: 73
verdict: done
steps:
  - title: "Slovníček CZ→EN"
    status: done
  - title: "nextPhase.ts → AJ"
    status: done
  - title: "planPhase.ts → AJ"
    status: done
  - title: "doPhase.ts → AJ"
    status: done
  - title: "Přegenerovat snapshoty a ověřit"
    status: done
---

# Fáze 73 — report z auto session

## Co se udělalo
- Založen sdílený slovníček `docs/i18n-glossary.md` s kanonickými překlady termínů
  (fáze→phase, krok→step, cíl→goal, stavy hotovo→done atd., nadpisy promptů) a
  pravidlem, co se **nepřekládá**. Slouží jako opora pro tuto i další fáze.
- Přeloženy tři buildery promptů do angličtiny:
  - `nextPhase.ts` — instrukční text, `PHASE_WORD`, bloky "Progress so far" /
    "Last phase" / "User's idea".
  - `planPhase.ts` — instrukční text, nadpis "Phase notes (from discussion)".
  - `doPhase.ts` — instrukční text, `STEP_WORD`, marker `← work on this`, věty
    "Implement the step / whole phase".
- U všech tří zachován response-kontrakt `TITLE:` / `GOAL:` / `STEP:` beze změny
  (parsery na něj spoléhají).
- Aktualizovány `toContain`/`not.toContain` aserce ve všech třech `*.test.ts` a
  přegenerovány snapshoty (`vitest -u`, 9 snapshotů).

## Ověření (strojově)
- `npm test` → 50 souborů, 651 testů, vše zelené.
- `npm run build` → tsc + copy-assets bez chyb.

## Na co dát pozor / otevřené
- **Mid-migration švy:** `GRAPH_USAGE_HINT` (`graphHint.ts`) zůstává **česky** —
  je sdílený mezi víc prompty, jeho překlad patří do pozdější fáze. Přeložené
  prompty tedy uvnitř pořád obsahují český blok s nápovědou ke grafu.
- Interaktivní cesta (slash commands / `mini context`) jede přes `sessionContext.ts`,
  který má vlastní kopii instrukcí a **zůstává česky** — přeložené buildery jsou
  headless cesta (`mini next/plan/do` přes API). Sjednocení přijde v dalších fázích.
- Testovací fixtury (názvy fází, cíle, projectMd) zůstaly česky záměrně — testuje
  se framing promptu, ne obsah dat.
