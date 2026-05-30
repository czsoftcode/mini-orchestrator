# Token report — cena promptů mini příkazů

Heuristika: odhad tokenů = délka textu / 4 (offline, ne přesný tokenizér Claude).
Reálný = celý prompt · Šablona = fixní text promptu · Vkládaný kontext = součet
obsahových bloků (projekt, historie fází, poznámky, …).

| Příkaz | Reálný | Šablona | Vkládaný kontext |
| --- | ---: | ---: | ---: |
| auto | 2815 | 1191 | 1624 |
| next | 1904 | 370 | 1534 |
| plan | 1846 | 222 | 1624 |
| do | 1792 | 1250 | 542 |
| discuss | 967 | 425 | 542 |
| writeMemory | 888 | 346 | 542 |
| done | 269 | 136 | 133 |

## Proč (rozpad vkládaného kontextu)

- **auto** — vkládaný kontext 1624 tok: diskuzní poznámky 67 %, kroky 23 %
- **next** — vkládaný kontext 1534 tok: last-memory 69 %, historie fází 28 %
- **plan** — vkládaný kontext 1624 tok: diskuzní poznámky 67 %, kroky 23 %
- **do** — vkládaný kontext 542 tok: kroky 69 %, fáze (název + cíl) 25 %
- **discuss** — vkládaný kontext 542 tok: kroky 69 %, fáze (název + cíl) 25 %
- **writeMemory** — vkládaný kontext 542 tok: kroky 69 %, fáze (název + cíl) 25 %
- **done** — vkládaný kontext 133 tok: fáze (název + cíl) 100 %

_Vygenerováno 2026-05-30T04:39:07.296Z · reprezentativní fáze: 40._
