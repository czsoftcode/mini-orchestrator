# Fáze 29 — Průběžný zápis kroků v do

**Cíl:** Přidat neinteraktivní pod-příkaz (např. mini do --apply --step-done <název>), který během /mini:do označí jednotlivý krok za hotový rovnou ve state.json, a rozšířit do session prompt o instrukci volat ho po každém dokončeném kroku — aby po pádu Claude bylo vidět, kde se skončilo.

## Kroky
- [hotovo] Přidat applyStepDone(title, cwd) do do.ts — najde krok aktuální fáze podle názvu (tolerantně: trim, fallback case-insensitive), označí ho done a hned uloží state.json; chyba když fáze není doing nebo se krok nenajde
- [hotovo] Zaregistrovat v cli.ts flag mini do --apply --step-done <název> — když je --step-done, volá applyStepDone, jinak stávající applyDoStart
- [hotovo] Rozšířit do session prompt (buildAutoPhasePrompt) o instrukci volat mini do --apply --step-done <přesný název> po každém dokončeném kroku, ještě před finálním reportem
- [hotovo] Testy v do.test.ts pro applyStepDone — úspěch, nenalezený krok, tolerantní matching; a test že prompt instrukci obsahuje
- [hotovo] typecheck/build/test a e2e přes lokální build: plan → do --apply → --step-done → ověřit že status kroku ve state.json je done

## Auto-commit
- Fáze 29: Průběžný zápis kroků v do (`786dd33b525dd0ece9fce7d934006c0f45cb8924`)

## Run report
---
phase: 29
verdict: done
steps:
  - title: "Přidat applyStepDone(title, cwd) do do.ts — najde krok aktuální fáze podle názvu (tolerantně: trim, fallback case-insensitive), označí ho done a hned uloží state.json; chyba když fáze není doing nebo se krok nenajde"
    status: done
  - title: "Zaregistrovat v cli.ts flag mini do --apply --step-done <název> — když je --step-done, volá applyStepDone, jinak stávající applyDoStart"
    status: done
  - title: "Rozšířit do session prompt (buildAutoPhasePrompt) o instrukci volat mini do --apply --step-done <přesný název> po každém dokončeném kroku, ještě před finálním reportem"
    status: done
  - title: "Testy v do.test.ts pro applyStepDone — úspěch, nenalezený krok, tolerantní matching; a test že prompt instrukci obsahuje"
    status: done
  - title: "typecheck/build/test a e2e přes lokální build: plan → do --apply → --step-done → ověřit že status kroku ve state.json je done"
    status: done
---

# Fáze 29 — report z auto session

Cíl fáze splněn: během `/mini:do` může Claude označit jednotlivý krok za hotový hned po
dokončení (`mini do --apply --step-done "<název>"`), takže po pádu session zůstane ve
`state.json` stopa, kam až se došlo. Finální report (a `mini done`) zůstávají beze změny.

## Co vzniklo

- **`applyStepDone(title, cwd)`** (`src/commands/do.ts`) — najde krok aktuální fáze podle
  názvu tolerantně (přesná shoda po `trim`, fallback case-insensitive přes nový helper
  `findStepByTitle`), označí ho `done` a **ihned uloží** `state.json`. Tvrdé pojistky:
  fáze musí být `doing` (`phase-not-doing`), krok musí existovat (`step-not-found`),
  prázdný název je chyba (`no-step-title`). Už hotový krok je no-op (idempotentní).
  Posun fáze ani finální statusy nedělá — ty řeší dál `mini done` z reportu.
- **CLI flag `mini do --apply --step-done <title>`** (`src/cli.ts`) — uvnitř `--apply`
  větve: když je `--step-done`, volá `applyStepDone`, jinak stávající `applyDoStart`.
- **Instrukce v `buildAutoPhasePrompt`** (`src/prompts/autoPhase.ts`) — nový blok
  „# Průběžný zápis kroků" říká Claudovi, ať po každém dokončeném kroku zavolá
  `mini do --apply --step-done "<přesný název>"` ještě před finálním reportem. Blok se
  renderuje **jen u fází rozmenených na kroky**; u fáze bez kroků chybí.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **388 testů, 33 souborů** (7 nových: 5× applyStepDone v do.test.ts,
  2× prompt blok v autoPhase.test.ts). 5 snapshotů autoPhase aktualizováno (přidaný blok).
- E2E přes lokální build (`node dist/cli.js`) v dočasném projektu: `next --apply` →
  `plan --apply` (2 kroky) → `do --apply` → `do --apply --step-done "  krok JEDNA  "`
  označil správně jen první krok (`Krok jedna:done | Krok dva:todo`) i přes mezery a
  jinou velikost písmen; neexistující krok skončil nenulovým exit kódem a stav nezměnil.

## Poznámky

- Stejně jako u fáze 28: globální `mini` na PATH je starší verze 0.1.0, která tenhle
  flag ještě nezná. Pro reálné použití `/mini:do` s průběžným zápisem bude potřeba
  obnovit globální instalaci z nového buildu (mimo rozsah fáze).
- `mini done` z reportu pak finální statusy přepíše/potvrdí — průběžné `done` se s ním
  nebije (krok je buď už `done`, nebo ho report nastaví dle skutečnosti).
