---
phase: 92
verdict: done
steps:
  - title: "Bump/push do argument-hint a parsování"
    status: done
  - title: "Předat bump/push do kroku done"
    status: done
  - title: "Přegenerovat nainstalované .md"
    status: done
  - title: "Upravit testy install-commands"
    status: done
  - title: "README + CHANGELOG"
    status: done
---

# Phase 92 — report from the auto session

Hotovo, vše ověřeno mechanicky (build + 725 testů zeleně).

## Co se udělalo

- **`src/install/commands.ts`** (kanonický zdroj slash-commandů) — auto def:
  - `argumentHint` rozšířen o `[--bump <level>] [--push]`,
  - sekce „Run arguments" doplněna o popis `--bump` (předává se do `mini done
    --apply`, default žádný bump) a `--push` (push po commitu, vyžaduje explicitní
    `--bump`),
  - úvodní oznámení zmiňuje i `--bump` / `--push`,
  - krok 6 (done) v cyklu: finální save je `mini done --apply [--bump <level>]
    [--push]` podle parsovaných argumentů + poznámka o `--push` vyžadujícím
    explicitní bump.
- **`.claude/commands/mini/auto.md`** přegenerován (`npm run build` +
  `node dist/cli.js install-commands --project`) — odpovídá nové definici.
- **`src/commands/install-commands.test.ts`** — odstraněna zastaralá aserce
  `not.toContain('mini done --apply --push')` (auto už pushovat může), přidán nový
  test, že auto.md obsahuje `--bump`, `--push`, finální `mini done --apply
  [--bump <level>] [--push]` a omezení „--push requires --bump".
- **README.md** — `/mini:auto` přehled i sekce „Autonomous /mini:auto" zmiňují
  nové přepínače.
- **CHANGELOG.md** — záznam do `[Unreleased]`.

## Poznámky

- CLI `mini auto` (`src/cli.ts`, `src/commands/auto.ts`, `AutoOptions`) už
  `--bump`/`--push` plně podporovalo a předávalo do `done()` — tato fáze řešila
  jen vystavení přes slash-command `.md`, kde se cyklus prochází ručně. Žádná
  změna chování CLI nebyla potřeba.
- Omezení „--push vyžaduje --bump" v CLI vynucuje `ensurePushHasBump`; ve
  slash-commandu je to instruováno textově (Claude příkaz sestavuje sám).
