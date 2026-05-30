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
