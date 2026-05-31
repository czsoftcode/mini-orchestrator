# Fáze 69 — Flag --discuss pro mini:auto

**Cíl:** Přidat do slash commandu /mini:auto flag --discuss, který vynutí krok discuss v každé fázi běhu (analogicky k --verify): rozšířit argument-hint, sekci Argumenty běhu, úvodní oznámení i podmínku kroku discuss v install-commands.ts a doplnit testy.

## Kroky
- [hotovo] Flag --discuss do auto.md
- [hotovo] Podmínka kroku discuss
- [hotovo] Testy a regenerace auto.md
- [hotovo] README a CHANGELOG

## Auto-commit
- Fáze 69: Flag --discuss pro mini:auto (`a576d904d00c76224d98c5fe0de8649f2c64f649`)

## Run report
---
phase: 69
verdict: done
steps:
  - title: "Flag --discuss do auto.md"
    status: done
  - title: "Podmínka kroku discuss"
    status: done
  - title: "Testy a regenerace auto.md"
    status: done
  - title: "README a CHANGELOG"
    status: done
verify: []
---

# Fáze 69 — report z auto session

## Co se udělalo
Přidán flag `--discuss` k `/mini:auto`, který vynutí krok discuss v každé fázi (analogicky k `--verify` z fáze 68).

- **`install-commands.ts`** (CommandDef `auto`) — argument-hint rozšířen o `[--discuss]`; nový bullet v sekci „Argumenty běhu" (vynutí discuss v každé fázi); úvodní oznámení teď zmiňuje `--yolo` / `--verify` / `--discuss` společně; krok 2 cyklu (discuss) přepsán na „podmíněně / vynuceně" — spustí se buď u složité fáze (a diskuse ještě neproběhla), **nebo** vždy s `--discuss`, jinak se přeskočí. Přegenerován `.claude/commands/mini/auto.md`.
- **Testy** — `install-commands.test.ts`: do testu autonomních argumentů přidány `--verify`/`--discuss`; nový test „auto command umí vynutit discuss přes --discuss". Celá suite: **648 testů zelených**, build OK.
- **README** — `--discuss` k `/mini:auto` (řádek příkazu i sekce „Autonomní `/mini:auto`").
- **CHANGELOG** — záznam do `## [Unreleased]` (Added).

## Na co dát pozor
- **Globální `mini` (1.3.0) neukazuje na lokální build** — `install-commands` je potřeba pouštět přes `node dist/cli.js …`, dokud se globální binárka nezaktualizuje.
- Flag je čistě **deklarativní v promptu** (řídí ho Claude v auto session) — žádná nová logika v TS, stejně jako u `--verify` a `--yolo`.

## Otevřené konce
- Žádné. Trojice přepínačů `--yolo` / `--verify` / `--discuss` je teď symetrická.
