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
