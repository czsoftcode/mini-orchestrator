---
phase: 79
verdict: done
steps:
  - title: "Přeložit status + undo do AJ"
    status: done
  - title: "Přeložit init + import-gsd + model + stop"
    status: done
  - title: "Přeložit map + audit + update + install-commands"
    status: done
  - title: "Přeložit migrate + renumber"
    status: done
  - title: "Ověřit výstup a zelený build"
    status: done
---

# Phase 79 — report from the auto session

## Co se povedlo

Pokračování i18n: přeloženy do angličtiny runtime hlášky **i** komentáře/JSDoc ve
12 utility/správních příkazech `src/commands/*` + jejich testy.

- **status + undo**: `status.ts` (PHASE/STEP/VERDICT labely `[done]`/`[doing]`/…,
  `nextActionHint`, `runReportSummaryLines`, `pluralVerify` → `item`/`items`),
  `undo.ts` (diff popisy, revert hlášky, plural `phase`/`phases`). Testy
  `status.test.ts` (asserty na EN) a `undo.test.ts` (popisy/komentáře).
- **init + import-gsd + model + stop**: hlášky, ask prompty, validace.
  **Nadpisy `project.md`** (`renderProjectMd` v init i import-gsd) přeloženy na
  `## What I'm building` / `## Who it's for` / `## Main constraints`. `status.ts`
  regex čte `Co stavím` **i** `What I'm building` (zpětná kompatibilita s českými
  project.md). `init.test.ts` aserty (`(none)`) + fixtury na EN.
- **map + audit + update + install-commands**: hlášky + komentáře; logy
  `installCommands` (`Created`/`Updated`/`Done — N commands…`) nově anglicky
  (dříve záměrně CZ). Plurály `file`/`files`, `command`/`commands`. Testy:
  popisy/komentáře přeloženy; `renderCommandMd`/`COMMAND_DEFS` se neměnily, takže
  generované `.claude/commands/mini/*.md` zůstávají beze změny.
- **migrate + renumber**: hlášky, JSDoc i komentáře; plurál `phase`/`phases`.
  Testy `migrate.test.ts` + `renumber.test.ts` (popisy, komentáře a fixtury titulů
  přeloženy konzistentně s aserty).

## Ověření (strojově, vše prošlo)

- `npm run build` — zelený.
- `npm test` — **651 testů / 50 souborů zelených**.
- `node dist/cli.js status` / `update --dry-run` / no-project warn — výstup
  anglicky (`Phases:`, `[done]`, `Models:`, `The project is up to date…`,
  `There is no project in this directory.`).
- Grep diakritiky ve všech 12 souborech + testech — čistý (kromě záměrné
  zpětně-kompatibilní části regexu `Co stavím` v `status.ts`).

## Poznámky / otevřené (mimo záběr této fáze)

- **`SCOPE_LABELS` v `src/state/models.ts` je pořád česky** — interaktivní picker
  `mini model` jí zobrazuje (např. „Default (pro vše…)"). `state/*` je vyhrazené
  pro další fázi i18n, proto ponecháno; přeloží se tam.
- **Build skript `scripts/copy-assets.mjs`** vypisuje česky („assety
  zkopírováno…") — není součást běhu programu (build-time), mimo záběr.
- Existující `.mini/project.md` (vč. tohoto repa) má pořád české nadpisy — to je
  uživatelská data; `status` je díky tolerantnímu regexu čte dál.
- Zbývá (dle glossary „Stav migrace"): lifecycle příkazy
  (do/done/next/plan/auto/discuss/context), `writeMemory`, reporty/memory
  (`state/*`), graph mappery (`graph/*`).
