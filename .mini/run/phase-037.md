---
phase: 37
verdict: done
steps:
  - title: "V src/commands/install-commands.ts (bod auto v COMMAND_DEFS) změnit závěrečné 'mini done --apply --push' na 'mini done --apply'. Ověřitelné: grep v souboru už neobsahuje 'mini done --apply --push'."
    status: done
  - title: "Upravit test v install-commands.test.ts (kolem ř. 58/68), aby očekával 'mini done --apply' a neočekával '--push'; upravit i název testu, ať nezmiňuje --push. Ověřitelné: npm test zelené."
    status: done
  - title: "Přegenerovat slash commandy (node dist/cli.js install-commands) a ověřit npm run typecheck + build + test zelené a že .claude/commands/mini/auto.md už neobsahuje --push."
    status: done
---

# Fáze 37 — report z auto session

Cíl splněn: `/mini:auto` už při závěrečném done automaticky nepushuje na remote.

## Co se udělalo

- **Bod auto v `COMMAND_DEFS`** (`src/commands/install-commands.ts`): závěrečný
  krok 4 (done) změněn z `mini done --apply --push` na `mini done --apply`.
  Přeformulováno na „Finální uložení udělej příkazem `mini done --apply`."
  (původně „… s nahráním na remote: `mini done --apply --push`").
- **Test** `install-commands.test.ts`: přejmenován (z názvu odstraněno „a --push"),
  asserce změněna — nově očekává `mini done --apply` a `not.toContain('mini done
  --apply --push')`, takže test hlídá, že se `--push` do auto.md nevrátí.
- **Přegenerováno** `node dist/cli.js install-commands` → `.claude/commands/mini/auto.md`
  (1 změněný command).

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓, `npm test` ✓ — 425 testů, 35 souborů
  (beze změny počtu — test byl jen upraven, ne přidán/ubrán).
- `grep -c "\-\-push" .claude/commands/mini/auto.md` → `0` (auto.md už `--push`
  neobsahuje).
- `auto.md` ř. 12 nyní končí `… příkazem mini done --apply.`

## Poznámky

- Bez `--push` se `mini done --apply` chová jako dřív u ostatních cest: po commitu
  fáze jen vypíše hint `git push` a nic na remote nenahraje. Push si uživatel
  spustí ručně (nebo `mini done --push`, pokud ho explicitně chce).
