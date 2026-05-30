---
phase: 61
verdict: done
steps:
  - title: "Parser id z názvu + mapování"
    status: done
  - title: "Kolizně-bezpečný rename engine"
    status: done
  - title: "Přepis state.json"
    status: done
  - title: "Přejmenování discuss/run/memory"
    status: done
  - title: "CLI flag + dry-run + integrační test"
    status: done
---

# Fáze 61 — report z auto session

Cíl splněn: `mini migrate --renumber` přečísluje fáze na souvislá celá čísla
(1..N podle pořadí ve `state.json`) a sjednotí názvy souborů ve všech čtyřech
adresářích na `phase-XXX`. Idempotentní, s dry-run náhledem a potvrzením.

## Co se udělalo

1. **`src/state/renumber.ts`** (čisté funkce + FS util):
   - `parsePhaseFile` — vytáhne id z názvu napříč schématy (paddované `001`,
     nepaddované `1`, desetinné `1.1`, `.prev.md`, memory s ISO timestampem
     i historický index `-2`). Nesoubory fáze → `null`.
   - `buildRenumberMap` — staré id → nové id = pozice+1 (souvislé 1..N).
   - `planSimpleDir` / `planMemoryDir` — plán přejmenování; memory grupuje víc
     souborů na fázi a řadí podle timestampu (`phase-XXX.md`, `-2`, `-3`).
   - `findCollisions` — dva zdroje na týž cíl / cíl obsazený nepřejmenovávaným
     (orphan) souborem.
   - `executeRenames` — **dvoufázový** rename (vše na dočasné názvy, pak na
     finální), takže překryv starých/nových názvů (29↔30) nic nepřepíše.
2. **`src/commands/renumber.ts`** — orchestrace. `phases/` + hlavičku řeší přes
   existující `save()` (zápis nových id, prune starých `.json`, **záloha pro
   `undo`**); `discuss/`/`run/`/`memory/` přejmenuje enginem. Orphany se nechají
   + warning, při kolizi **abort** (nic se nezmění). No-op na už narovnaném
   projektu. Legacy v1 stav → hláška „nejdřív `mini migrate`".
3. **CLI**: `mini migrate --renumber [--dry-run]`. Bez `--dry-run` se před
   zápisem ptá na potvrzení (prompts confirm).

## Ověření (strojově)

- Unit testy `renumber.test.ts` (parser, mapování vč. Symfony rozsahu 1..31,
  plán simple/memory, kolize) — 18 testů.
- Integrační testy `commands/renumber.test.ts` — fixture reprodukující smíšené
  schéma (paddované `.json` + nepaddované `.md` + memory s timestampem +
  `.prev.md` + desetinná id): plný průchod (1,1.1,2.1,29,30 → 1..5), idempotence,
  dry-run nic nezapíše, zrušené potvrzení nic nezapíše, kolize → abort,
  dvoufázový swap 29↔30 — 6 testů.
- Celá sada **600/600**, `tsc` build čistý.
- Smoke test CLI `node dist/cli.js migrate --renumber --dry-run` na dočasné
  fixtuře: mapování i počty sedí, dry-run nic nezapsal.

## Poznámky / vědomá omezení

- **Crash-safety napříč 4 adresáři není absolutní** (jak avizováno v diskusi).
  Stav + `phases/` jdou přes `save()` (atomický zápis hlavičky + záloha pro
  `mini undo`), `.md` přejmenování je per-adresář dvoufázové. Při přerušení
  uprostřed je primární záchrana `git` (+ `mini undo` pro stav). Po úspěchu se
  vypisuje hint na `git diff`/`git status`.
- Tahle migrace běží v **cílovém** projektu (např. Symfony), ne v repu mini —
  mini je už narovnaný (1..61), takže `--renumber` by tu byl no-op.
- Memory s víc soubory na fázi je ošetřené obecně (sort + `-2`/`-3`), i když
  v praxi je tam zatím 1:1.
