# Fáze 61 — Migrate: přečíslování a sjednocení fází

**Cíl:** Rozšířit mini migrate o přečíslování fází na souvislá celá čísla (podle pořadí ve state.json) a přejmenování souborů v phases/discuss/memory/run na phase-XXX — idempotentně a crash-safe, s opravou id/currentPhaseId ve stavu a ošetřením .prev.md i memory bez data.

## Kroky
- [hotovo] Parser id z názvu + mapování
- [hotovo] Kolizně-bezpečný rename engine
- [hotovo] Přepis state.json
- [hotovo] Přejmenování discuss/run/memory
- [hotovo] CLI flag + dry-run + integrační test

## Auto-commit
- Fáze 61: Migrate: přečíslování a sjednocení fází (`94a950ab1d7b40e343943a171ee5018fa051c9f0`)

## Diskuse
# Fáze 61 — Migrate: přečíslování a sjednocení fází

## Záměr
Rozšířit `mini migrate` o novou, oddělenou schopnost (vedle stávajícího
převodu v1→v2): **přečíslovat fáze na souvislá celá čísla** a **přejmenovat
soubory ve všech čtyřech adresářích** (`phases/`, `discuss/`, `run/`, `memory/`)
na kanonický `phase-XXX`. Cílem je narovnat projekty se smíšeným/legacy
číslováním — typicky ten Symfony projekt, kde vznikly desetinná id (`1.1`…`28.1`)
jako „opravné" sub-fáze vedle celých (`1`, `29`, `30`).

## Klíčová rozhodnutí
- **Zdroj pravdy = pořadí v `state.json` (pole `phases`).** Nové id = 1-based
  pozice ve frontě. Pořadí je chronologické (sedí i na časy v memory). Mapování
  pro Symfony projekt: `1→1`, `1.1→2`, `2.1→3`, …, `28.1→29`, `29→30`, `30→31`
  (souvislé 1..31). Důsledek odsouhlasen: dnešní celá `29/30` se posunou o jedna.
  „Utni desetinnou část" je vyloučeno — `1` i `1.1` jsou dvě reálné různé fáze
  (orig + oprava), strip by kolidoval.
- **Spouštění: explicitní flag + dry-run.** Default `mini migrate` zůstává beze
  změny. Přečíslování pod vlastním přepínačem (např. `mini migrate --renumber`),
  s `--dry-run` náhledem mapování a potvrzením před zápisem. Přesný název
  flagu/UX doladit v plan.
- **Orphany: nechat + warning; při kolizi cílového názvu abort.** Soubory bez
  záznamu ve `state.json` se nepřejmenují, jen se na ně upozorní. Kdyby cílový
  název kolidoval s existujícím (orphan i ne), migrace skončí jasnou chybou —
  nic se nepřepíše ani neztratí. (V tomhle projektu fakticky žádné orphany
  nejsou — všech 31 souborů sedí na id ve `state.json`.)
- **Dvě konvence starých názvů.** Projekt vznikl pod starou verzí mini (před
  fází 60): `phases/` je paddované (`phase-001.json`), ale `discuss/run/memory`
  NEpaddované (`phase-1.md`, `phase-1.1.md`, memory navíc s ISO timestampem
  `phase-1.1-2026-…Z.md`). Migrace musí old soubory dohledat **parsováním id
  z názvu**, ne předpokladem jediného schématu: strip `phase-` prefixu a
  `.md`/`.json`, strip volitelného `.prev`, strip volitelného `-<timestamp>`
  (memory) → zbytek je id string (`001`,`1`,`1.1`,`29`) → `parseFloat` →
  porovnat číselně s id ve `state.json`.
- **Co se přepisuje:** u každé fáze `id` v jejím `.json`, dále `phases[].id`
  v hlavičce a `currentPhaseId` (přemapovat; tady je `null`). Soubory přejmenovat
  ve všech 4 adresářích, vč. `run/*.prev.md` → `phase-XXX.prev.md` a memory
  (zahodit timestamp → `phase-XXX.md`).

## Pozor na
- **Kolize při přejmenování kvůli překryvu starých a nových id** (`29→030`, ale
  `phase-030.json` od staré `30` ještě existuje). Řešit **dvoufázovým
  přejmenováním** — nejdřív vše na unikátní dočasné názvy, pak na finální.
- **Memory: víc souborů na jednu fázi.** Tady 1:1, ale obecně historie (`-2`,
  `-3` z fáze 60, nebo víc timestampů). Při přejmenování seřadit podle timestampu
  a namapovat na `phase-XXX.md`, `phase-XXX-2.md`, … (využít/zobecnit
  `freeMemoryFileName`).
- **Idempotence:** na už narovnaném projektu (id přesně `1..N` a názvy už
  kanonické `phase-XXX`) musí být no-op. Detekovat předem.
- **Crash-safety napříč 4 adresáři** je těžká; primární záchrana je `--dry-run`
  náhled + projekt pod gitem. Aspoň pořadí kroků volit tak, aby přerušení šlo
  bezpečně zopakovat (re-run idempotentní/dokončující).
- **Velikost fáze:** je to spíš na horní hranici (přepis stavu + parser starých
  názvů + 4 adresáře + dvoufázový rename + dry-run + idempotence + testy).
  Zvážit v plan rozdělení kroků; případně první kus = jádro (state + phases/),
  zbytek navazující.
- Testy: fixture v temp adresáři reprodukující smíšené schéma (paddované .json
  + nepaddované .md + memory s timestampem + `.prev.md`), ověřit mapování,
  dvoufázový rename, idempotenci a abort při kolizi.

## Run report
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
