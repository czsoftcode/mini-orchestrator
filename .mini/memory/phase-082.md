# Fáze 82 — Anglické lifecycle příkazy

**Cíl:** Přeložit do angličtiny runtime hlášky i komentáře/JSDoc v lifecycle příkazech src/commands/ (done.ts, do.ts, next.ts, plan.ts, auto.ts, context.ts, discuss.ts) a SCOPE_LABELS v src/state/models.ts, včetně dotčených testů (done/do/next/plan/auto/auto.e2e/apply/context). Sjednotit šablonu auto-commit subjectu (dnes 'Fáze {id}: {title}') na anglické 'Phase {id}: {title}', ať sedí s přeloženým README — ověřit, že to nerozbije undo (matchování commitů jde přes preSha, ne subject) ani parsování. Beze změny: response-kontrakt (TITLE/GOAL/STEP/...), stavová slova, názvy příkazů/flagů a cesty. Ověřit npm test + build zelené.

## Kroky
- [hotovo] Přeložit done.ts + commit subject + testy
- [hotovo] Přeložit do.ts + context.ts + testy
- [hotovo] Přeložit next.ts + plan.ts + testy
- [hotovo] Přeložit auto.ts + discuss.ts + SCOPE_LABELS + testy
- [hotovo] Ověřit build a zelené testy

## Auto-commit
- Fáze 82: Anglické lifecycle příkazy

## Diskuse
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

## Run report
---
phase: 82
verdict: done
steps:
  - title: "Přeložit done.ts + commit subject + testy"
    status: done
  - title: "Přeložit do.ts + context.ts + testy"
    status: done
  - title: "Přeložit next.ts + plan.ts + testy"
    status: done
  - title: "Přeložit auto.ts + discuss.ts + SCOPE_LABELS + testy"
    status: done
  - title: "Ověřit build a zelené testy"
    status: done
---

# Phase 82 — report from the auto session

Celá fáze hotová. Lifecycle příkazy v `src/commands/` jsou přeložené do angličtiny
— runtime hlášky (`log.*`, `ask()` prompty, choices) i komentáře/JSDoc:

- **done.ts** — všechny větve (auto report, interaktivní fallback, verify body,
  commit/push/tag, changelog stamp). `buildPhaseCommitMessage` mění subject
  `Fáze {id}: {title}` → `Phase {id}: {title}`. Pluralizace převedena na
  EN 2-tvar (`unfinished step`/`unfinished steps`, `step`/`steps`,
  `item`/`items`, `a blocker was`/`blockers were`).
- **do.ts**, **context.ts**, **next.ts**, **plan.ts**, **auto.ts**, **discuss.ts** —
  hlášky i komentáře. `RETRY_FORMAT_NOTE` v next.ts přepsán do AJ (test assert na
  „nešla přečíst" → „could not be read"). Auto-labely `[auto 1/4] …` přeloženy.
- **SCOPE_LABELS** v `src/state/models.ts` — 7 popisů scope do AJ.

Testy v záběru přepsány (it() popisy, komentáře, fixtury i asserty na změněné
řetězce): done/do/next/plan/auto/auto.e2e/apply/context. Fixtury kroků
sjednoceny (`krok N` → `step N`), CHANGELOG fixtura i regex asserty
(`nová funkce` → `new feature`). Asserty na commit subject přepnuty na `Phase …`.

**Ověření (mechanicky):**
- `npm run build` — zelené.
- `npm test` — 652 testů zelených (50 souborů).
- `grep` přes diakritiku v 8 zdrojácích = 0 výskytů; generovaný commit subject je
  `Phase {id}: {title}` (assert v done.test.ts).
- Undo není dotčené: matchování commitu jde přes `preSha` (`undo.ts`), ne přes
  subject; žádný parser na subjectu nezávisí.

Beze změny zůstal response-kontrakt (`TITLE:`/`GOAL:`/`STEP:`), stavová slova,
názvy příkazů/flagů a cesty. `git.test.ts` jsem se podle diskuse nedotýkal
(používá `Fáze 1: …` jen jako náhodnou fixturu, netestuje formát done).
