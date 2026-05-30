# Fáze 35 — Slash command /mini:auto

**Cíl:** Přidat do install-commands.ts nový command /mini:auto s vlastním body, který v jedné Claude session zřetězí kroky workflow: volitelně discuss (jen když je fáze složitá na rozhodnutí a discuss ještě neproběhl), pak plan, do a nakonec done --push — včetně testů a přegenerování commandů.

## Kroky
- [hotovo] Do COMMAND_DEFS v install-commands.ts přidat položku auto (description „mini — celý cyklus fáze v jedné session") s vlastním body, který instruuje Claude provést v jedné session sekvenci: nejdřív zvážit mini context discuss (spustit jen když je fáze složitá na rozhodnutí a discuss ještě neproběhl, jinak přeskočit), pak mini context plan, pak mini context do, nakonec mini context done a uložit přes mini done --apply --push. Výstup: renderCommandMd pro auto vrací md, jehož tělo obsahuje všechny čtyři kroky i --push a podmínku na discuss.
- [hotovo] Doplnit hint na konci installCommands o /mini:auto. Výstup: vypsaný seznam dostupných commandů obsahuje /mini:auto.
- [hotovo] Rozšířit install-commands.test.ts: do seznamu očekávaných souborů přidat auto.md; nový test, že auto.md zmiňuje sekvenci discuss→plan→do→done, podmínku na discuss i --push. Výstup: nové i upravené testy zelené.
- [hotovo] Ověřit npm run typecheck + build + test; přegenerovat přes node dist/cli.js install-commands a ověřit, že vznikne .claude/commands/mini/auto.md. Výstup: vše zelené, soubor auto.md existuje.

## Auto-commit
- Fáze 35: Slash command /mini:auto (`620a1c7bf4e53cfb68b4e84010f4538e3e6850cc`)

## Run report
---
phase: 35
verdict: done
steps:
  - title: "Do COMMAND_DEFS v install-commands.ts přidat položku auto (description „mini — celý cyklus fáze v jedné session\") s vlastním body, který instruuje Claude provést v jedné session sekvenci: nejdřív zvážit mini context discuss (spustit jen když je fáze složitá na rozhodnutí a discuss ještě neproběhl, jinak přeskočit), pak mini context plan, pak mini context do, nakonec mini context done a uložit přes mini done --apply --push. Výstup: renderCommandMd pro auto vrací md, jehož tělo obsahuje všechny čtyři kroky i --push a podmínku na discuss."
    status: done
  - title: "Doplnit hint na konci installCommands o /mini:auto. Výstup: vypsaný seznam dostupných commandů obsahuje /mini:auto."
    status: done
  - title: "Rozšířit install-commands.test.ts: do seznamu očekávaných souborů přidat auto.md; nový test, že auto.md zmiňuje sekvenci discuss→plan→do→done, podmínku na discuss i --push. Výstup: nové i upravené testy zelené."
    status: done
  - title: "Ověřit npm run typecheck + build + test; přegenerovat přes node dist/cli.js install-commands a ověřit, že vznikne .claude/commands/mini/auto.md. Výstup: vše zelené, soubor auto.md existuje."
    status: done
---

# Fáze 35 — report z auto session

Cíl splněn: přibyl slash command `/mini:auto`, který v jedné Claude session
zřetězí celý cyklus aktuální fáze — volitelně discuss, pak plan, do a nakonec
done s nahráním na remote.

## Co vzniklo / změnilo se

- **`src/commands/install-commands.ts`**:
  - nová položka `auto` v `COMMAND_DEFS` s vlastním `body` (description
    „mini — celý cyklus fáze v jedné session"). Tělo popisuje 4 kroky v pořadí:
    1. **discuss** — podmíněně, **jen** když je fáze složitá na rozhodnutí
       **a** diskuse ještě neproběhla; jinak přeskočit,
    2. **plan** (`mini context plan` → `mini plan --apply`),
    3. **do** (`mini context do`, vč. průběžných `--step-done` a reportu),
    4. **done** (`mini context done` → `mini done --apply --push`).
    Tělo navíc instruuje hlásit uživateli postup a zastavit se na blokeru.
  - hint na konci `installCommands` rozšířen o `/mini:auto`.
- **`src/commands/install-commands.test.ts`**:
  - očekávaný seznam souborů doplněn o `auto.md` (a o `auto` v testu
    idempotence),
  - nový test, že `auto.md` zmiňuje `mini context` pro discuss/plan/do/done,
    podmíněnost discuss a `mini done --apply --push`.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **423 testů, 35 souborů** zelených (předtím 422, +1 nový).
- `node dist/cli.js install-commands` → vytvořilo `.claude/commands/mini/auto.md`
  (1 nový, 7 beze změny); soubor existuje a obsah odpovídá.

## Poznámky

- `auto` záměrně **nevolá** `mini context auto` — žádný takový context prompt
  neexistuje. Command je čistě orchestrační wrapper, který Claude provede
  sekvencí ostatních `mini context <name>` kroků v rámci jedné session.
  Proto není zařazen do testu „každý workflow command volá mini context <name>"
  (ten ověřuje jen next/discuss/plan/do/done).
- Pozor na odlišení od staršího `src/commands/auto.ts` — to je standalone CLI
  orchestrátor spouštějící vlastní Claude sessions (next→plan→do→done). Nový
  `/mini:auto` běží naopak uvnitř aktuální session jako slash command.
