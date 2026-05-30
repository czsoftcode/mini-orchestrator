# Token report — cena promptů mini příkazů

Heuristika: odhad tokenů = délka textu / 4 (offline, ne přesný tokenizér Claude).
Reálný = celý prompt · Šablona = fixní text promptu · Vkládaný kontext = součet
obsahových bloků (projekt, historie fází, poznámky, …).

| Příkaz | Reálný | Šablona | Vkládaný kontext |
| --- | ---: | ---: | ---: |
| auto | 2739 | 1285 | 1454 |
| do | 1680 | 226 | 1454 |
| plan | 1677 | 223 | 1454 |
| next | 1583 | 369 | 1214 |
| discuss | 1051 | 425 | 626 |
| writeMemory | 972 | 346 | 626 |
| done | 268 | 139 | 129 |

## Proč (rozpad vkládaného kontextu)

- **auto** — vkládaný kontext 1454 tok: diskuzní poznámky 57 %, kroky 32 %
- **do** — vkládaný kontext 1454 tok: diskuzní poznámky 57 %, kroky 32 %
- **plan** — vkládaný kontext 1454 tok: diskuzní poznámky 57 %, kroky 32 %
- **next** — vkládaný kontext 1214 tok: last-memory 63 %, historie fází 34 %
- **discuss** — vkládaný kontext 626 tok: kroky 74 %, fáze (název + cíl) 21 %
- **writeMemory** — vkládaný kontext 626 tok: kroky 74 %, fáze (název + cíl) 21 %
- **done** — vkládaný kontext 129 tok: fáze (název + cíl) 100 %

_Vygenerováno 2026-05-30T03:05:53.916Z · reprezentativní fáze: 38._
