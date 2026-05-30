# Fáze 47 — Zapisovat jen změněné fáze

**Cíl:** save() ve store.ts zapíše soubor fáze jen když se její serializovaný JSON liší od obsahu na disku, a snapshotPrev kopíruje do phases-prev jen reálně změněné soubory místo rm+copy celého adresáře, takže počet diskových operací škáluje s počtem změn, ne s počtem fází; ověřitelné novým testem, že nezměněná fáze se znovu nezapíše, a zelenou bránou.

## Kroky
- [hotovo] Helper writeJsonIfChanged
- [hotovo] save() zapisuje jen změněné fáze
- [hotovo] snapshotPrev() synchronizuje diferenčně
- [hotovo] Test: nezměněná fáze se znovu nezapíše
- [hotovo] Zelená brána

## Auto-commit
- Fáze 47: Zapisovat jen změněné fáze (`40876e1aafd3b55440d245d6818132b7d7bd2e98`)

## Run report
---
phase: 47
verdict: done
steps:
  - title: "Helper writeJsonIfChanged"
    status: done
  - title: "save() zapisuje jen změněné fáze"
    status: done
  - title: "snapshotPrev() synchronizuje diferenčně"
    status: done
  - title: "Test: nezměněná fáze se znovu nezapíše"
    status: done
  - title: "Zelená brána"
    status: done
---

# Fáze 47 — report z auto session

## Co se udělalo

Cíl byl odstranit zbytečné diskové operace: doteď `save()` při každém uložení
přepsal **všechny** soubory fází a `snapshotPrev()` celý `phases-prev` zahodil
(`rm -r`) a znovu nakopíroval. Při rostoucím počtu fází to bylo O(N) zápisů na
každé uložení, i když se měnila jen jedna fáze.

- **`writeJsonIfChanged` (store.ts)** — nový privátní helper: serializuje data,
  přečte cílový soubor a zapíše atomicky (tmp + rename) jen když se obsah liší.
  Chybějící cíl = zapsat. Vrací `boolean`, zda reálně zapsal.
- **`save()`** — smyčka přes `state.phases` teď volá `writeJsonIfChanged` místo
  bezpodmínečného `writeJsonAtomic`. Pruning osiřelých souborů i zápis hlavičky
  zůstaly beze změny.
- **`snapshotPrev()`** — místo `rm` celého adresáře + kopie všech souborů
  synchronizuje `phases-prev` diferenčně: kopíruje jen soubory s odlišným (nebo
  v prev chybějícím) obsahem a maže z prev ty, co už v `phases` nejsou. Výsledek
  je stále přesné zrcadlo `phases`, takže undo (`loadPrev`/`restorePrev`) funguje
  dál.

## Ověření

- Nové testy v `store.test.ts`:
  - opakovaný `save` se stejným stavem nezmění `mtime` souborů fází (nic se
    nepřepsalo),
  - `save` se změnou jedné fáze přepíše jen ji; nezměněná fáze drží `mtime`,
    prev-vrstva drží předchozí podobu změněné fáze.
- `npm run typecheck` — bez chyb.
- `npm test` — 36 souborů, 465 testů zelených (včetně stávajících testů undo,
  prune a snapshotu prev, které ověřují, že chování navenek zůstalo stejné).
- `npm run build` — čistý.

## Poznámky

- Žádná změna veřejného API ani formátu na disku — jen úspora I/O.
- Hlavička `state.json` se i nadále zapisuje při každém `save` (mění se skoro
  vždy: summaries fází). To je jeden malý soubor, takže to nebylo cílem fáze.
- V projektu není lint skript, brána = typecheck + test + build.
