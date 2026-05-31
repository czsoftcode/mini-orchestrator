# Phase 82 — Anglické lifecycle příkazy

## Intent

Předposlední velký kus i18n: přeložit do angličtiny **runtime hlášky i komentáře/
JSDoc** v lifecycle příkazech `src/commands/` (`done.ts`, `do.ts`, `next.ts`,
`plan.ts`, `auto.ts`, `context.ts`, `discuss.ts`) a `SCOPE_LABELS` v
`src/state/models.ts`, včetně dotčených testů. Po této fázi je celá runtime
vrstva, kterou uživatel vidí, anglicky.

## Key decisions

1. **Auto-commit subject `Fáze {id}: {title}` → `Phase {id}: {title}`**
   (potvrzeno uživatelem). Mění se `buildPhaseCommitMessage` v `done.ts:192`.
   - Bezpečné: `mini undo` matchuje commit přes `preSha` (`HEAD^ === preSha`),
     **ne** přes subject (viz `undo.ts`); žádný parser na subjectu nezávisí.
     Subject se jen ukládá do `phase.autoCommit.subject` a vypisuje (`Commit: …`).
   - **Nutno přepsat asserty** v `done.test.ts` (ř. ~764 `'Fáze 7: Něco hotového'`,
     ~786 `'Fáze 1: Bez poznámek'`, ~857/876 `'Fáze 1: Fáze ke commitu'`,
     ~1012 `'Fáze 2: Fáze s poznámkou\n\n…'`) na `Phase …`.
   - Historické `autoCommit.subject` v `state.json` (minulé fáze) zůstávají české
     — archivní data, neměnit.
2. **Záběr překladu**: všechny runtime řetězce + komentáře/JSDoc v 7 příkazech +
   `SCOPE_LABELS` (5 položek: Default/next/plan/do/importGsd/audit/memory popisy).
3. **Testy v záběru**: `done.test.ts`, `do.test.ts`, `next.test.ts`,
   `plan.test.ts`, `auto.test.ts`, `auto.e2e.test.ts`, `apply.test.ts`,
   `context.test.ts` — `it()` popisy, komentáře, fixtury i asserty na změněné
   řetězce.
4. Beze změny: response-kontrakt parserů (`TITLE:`/`GOAL:`/`STEP:` a v importu
   `NAME:`/… — ale import-gsd není v této fázi), stavová slova
   (`done`/`doing`/`todo`/`skipped`/`proposed`), názvy příkazů, flagy, `/mini:*`
   reference, cesty.

## Watch out for

- **Pluralizace**: čeština má víc tvarů, AJ jen 2. Dotčené: `plan.ts`
  (`krok`/`kroků`), `done.ts` (`nedokončený krok`/`nedokončených kroků`,
  `bod`/`bodů`, `bloker`/`blokery`), `auto.ts`. Zjednodušit na `n === 1 ? … : …`.
- **`done.ts` je velký (208 ř.)** a má hodně větví (interaktivní finalize,
  apply cesta, opravné podfáze, verify body, blokery). Projít systematicky, ať
  nezůstane žádná `log.*` hláška česky.
- **`git.test.ts`** používá `'Fáze 1: …'` jen jako náhodnou fixturu pro
  `commitAll`/`headSubject` — **netestuje** formát `done`. Patří do pozdější
  infra fáze; v této fázi se ho NEdotýkat (commit accept libovolný string,
  nerozbije se).
- **`context.ts`** mapuje `cmd → prompt builder`; přeložit chybové hlášky
  (neznámý cmd apod.), ne názvy kroků (`next`/`plan`/…).
- **Projevení u uživatele**: anglický commit subject (i ostatní změny) se do
  globálně instalovaného `mini` dostanou až dalším vydáním (`done --push` s bumpem)
  a reinstalací; náš vlastní `mini done` v tomto repu pořád běží na globální
  1.4.1, takže commity fází 82/83 budou ještě „Fáze …" — žádný konflikt
  s CLAUDE.md (commity = naše komunikace, CZ).
