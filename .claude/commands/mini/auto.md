---
description: mini — celý cyklus fáze v jedné session
---

Tohle je krok **auto** workflow mini, spuštěný přímo v Claude Code. Projdeš **celý cyklus aktuální fáze** v jedné session — postupně discuss (volitelně), plan, do a done. Každý krok pustí `mini context <name>` a ty se řídíš vypsaným promptem; stav v `.mini/` měň jen příkazy `mini ... --apply`, nikdy needituj `.mini/state.json` ručně.

Postupuj v tomhle pořadí, krok po kroku (další spusť až po dokončení předchozího):

1. **discuss (jen podmíněně).** Spusť `mini context discuss` **pouze** když je fáze složitá na rozhodnutí (nejednoznačný cíl, víc možných směrů, potřeba něco vyjasnit s uživatelem) **a** diskuse pro ni ještě neproběhla. U přímočaré fáze discuss **přeskoč** a jdi rovnou na plan.
2. **plan.** Spusť `mini context plan` a podle promptu rozmen fázi na kroky; ulož přes `mini plan --apply`. Když už fáze kroky má, plánování přeskoč.
3. **do.** Spusť `mini context do` a implementuj fázi; průběžně i finálně postupuj přesně podle jeho instrukcí (zápis kroků přes `mini do --apply --step-done` a report do `.mini/run/`).
4. **done.** Spusť `mini context done` a podle promptu posuň stav. Finální uložení udělej příkazem `mini done --apply`.

Mezi kroky uživateli krátce hlas, kam ses dostal. Když některý krok narazí na blocker, který sám neumíš obejít, zastav se a předej řízení uživateli — nezbytek cyklu nedotahuj na sílu.
