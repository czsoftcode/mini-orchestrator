# Token report — cena promptů mini příkazů

Heuristika: odhad tokenů = délka textu / 4 (offline, ne přesný tokenizér Claude).
Reálný = celý prompt · Šablona = fixní text promptu · Vkládaný kontext = součet
obsahových bloků (projekt, historie fází, poznámky, …).

| Příkaz | Reálný | Šablona | Vkládaný kontext |
| --- | ---: | ---: | ---: |
| auto | 2827 | 1172 | 1655 |
| next | 1971 | 369 | 1602 |
| plan | 1876 | 221 | 1655 |
| do | 1835 | 180 | 1655 |
| discuss | 899 | 423 | 476 |
| writeMemory | 819 | 343 | 476 |
| done | 267 | 183 | 84 |

## Proč (rozpad vkládaného kontextu)

- **auto** — vkládaný kontext 1655 tok: diskuzní poznámky 71 %, kroky 22 %
- **next** — vkládaný kontext 1602 tok: last-memory 71 %, historie fází 26 %
- **plan** — vkládaný kontext 1655 tok: diskuzní poznámky 71 %, kroky 22 %
- **do** — vkládaný kontext 1655 tok: diskuzní poznámky 71 %, kroky 22 %
- **discuss** — vkládaný kontext 476 tok: kroky 75 %, fáze (název + cíl) 18 %
- **writeMemory** — vkládaný kontext 476 tok: kroky 75 %, fáze (název + cíl) 18 %
- **done** — vkládaný kontext 84 tok: fáze (název + cíl) 100 %

_Vygenerováno 2026-05-30T03:49:41.155Z · reprezentativní fáze: 39._
