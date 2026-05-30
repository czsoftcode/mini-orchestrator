# Fáze 34 — Mini:next se ptá na plán

**Cíl:** Když /mini:next dostane prázdný nápad, session prompt přiměje Claude nejdřív se uživatele zeptat, zda má pro další fázi vlastní představu, nebo to má nechat na Claude — a teprve podle odpovědi navrhne fázi.

## Kroky
- [hotovo] Do buildNextSessionPrompt (src/prompts/sessionContext.ts) přidat pro větev bez userHint instrukci: než Claude něco navrhne, ať se uživatele zeptá, zda má pro další fázi vlastní představu, nebo to má nechat na Claude — a teprve podle odpovědi pokračuje. Výstup: prompt bez nápadu obsahuje pokyn nejdřív se zeptat.
- [hotovo] Zajistit, že při zadaném userHint se dotaz nevkládá (uživatel už nápad dal). Výstup: prompt s userHint instrukci na dotaz neobsahuje.
- [hotovo] Rozšířit testy v sessionContext.test.ts — nový test, že bez nápadu prompt obsahuje dotaz na vlastní plán, a test, že s nápadem ho neobsahuje. Výstup: nové testy zelené.
- [hotovo] Ověřit npm run typecheck/build/test; přegenerovat command přes node dist/cli.js install-commands a ověřit, že vše prochází. Výstup: vše zelené.

## Auto-commit
- Fáze 34: Mini:next se ptá na plán (`204eb9808bbc520f3de91cc5e0e05e580d24ca61`)

## Run report
---
phase: 34
verdict: done
steps:
  - title: "Do buildNextSessionPrompt (src/prompts/sessionContext.ts) přidat pro větev bez userHint instrukci: než Claude něco navrhne, ať se uživatele zeptá, zda má pro další fázi vlastní představu, nebo to má nechat na Claude — a teprve podle odpovědi pokračuje. Výstup: prompt bez nápadu obsahuje pokyn nejdřív se zeptat."
    status: done
  - title: "Zajistit, že při zadaném userHint se dotaz nevkládá (uživatel už nápad dal). Výstup: prompt s userHint instrukci na dotaz neobsahuje."
    status: done
  - title: "Rozšířit testy v sessionContext.test.ts — nový test, že bez nápadu prompt obsahuje dotaz na vlastní plán, a test, že s nápadem ho neobsahuje. Výstup: nové testy zelené."
    status: done
  - title: "Ověřit npm run typecheck/build/test; přegenerovat command přes node dist/cli.js install-commands a ověřit, že vše prochází. Výstup: vše zelené."
    status: done
---

# Fáze 34 — report z auto session

Cíl splněn: `/mini:next` se teď při prázdném nápadu nejdřív zeptá uživatele,
zda má pro další fázi vlastní představu (mohl ji omylem nezadat), nebo to má
nechat na Claude — a teprve podle odpovědi navrhne fázi.

## Co vzniklo / změnilo se

- **`src/prompts/sessionContext.ts`** (`buildNextSessionPrompt`):
  - nový `askBlock`, který se vkládá **jen** když chybí `userHint`. Obsahuje
    sekci „# Nejdřív se zeptej" s pokynem zeptat se uživatele na vlastní plán
    a dvěma větvemi dalšího postupu (vlastní nápad → vyjít z něj; nechat na
    Claude → navrhnout sám podle postupu a stavu kódu).
  - `askBlock` zařazen do šablony před `hintBlock` (`${memoryBlock}${askBlock}${hintBlock}# Tvůj úkol`).
    Když je `userHint` zadaný, `askBlock` je prázdný a vkládá se naopak `hintBlock` —
    obě větve se tak vzájemně vylučují.
- **`src/prompts/sessionContext.test.ts`**:
  - nový test „bez nápadu přiměje Claude nejdřív se zeptat na vlastní plán",
  - nový test „se zadaným nápadem se na vlastní plán neptá".

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **422 testů, 35 souborů** zelených (předtím 420, +2 nové).
- `node dist/cli.js install-commands` → 0 nových, 0 změněných (`next.md` je
  tenký wrapper nad `mini context next`, takže se nemění — změna je čistě
  v promptu, který CLI vypisuje za běhu).

## Poznámky

- Bez breaking změny: jde o úpravu znění promptu pro větev bez nápadu. Když
  uživatel nápad zadá (`/mini:next <nápad>`), chování zůstává beze změny.
