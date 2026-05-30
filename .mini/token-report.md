# Token report — cena promptů mini příkazů

Heuristika: odhad tokenů = délka textu / 4 (offline, ne přesný tokenizér Claude).
Reálný = celý prompt · Šablona = fixní text promptu · Vkládaný kontext = součet
obsahových bloků (projekt, historie fází, poznámky, …).

| Příkaz | Reálný | Šablona | Vkládaný kontext |
| --- | ---: | ---: | ---: |
| auto | 2391 | 1165 | 1226 |
| do | 1703 | 1278 | 425 |
| next | 1453 | 371 | 1082 |
| plan | 1447 | 221 | 1226 |
| discuss | 885 | 424 | 461 |
| writeMemory | 806 | 345 | 461 |
| done | 267 | 190 | 77 |

## Proč (rozpad vkládaného kontextu)

- **auto** — vkládaný kontext 1226 tok: diskuzní poznámky 62 %, kroky 28 %
- **do** — vkládaný kontext 425 tok: kroky 82 %, fáze (název + cíl) 18 %
- **next** — vkládaný kontext 1082 tok: last-memory 56 %, historie fází 41 %
- **plan** — vkládaný kontext 1226 tok: diskuzní poznámky 62 %, kroky 28 %
- **discuss** — vkládaný kontext 461 tok: kroky 75 %, fáze (název + cíl) 17 %
- **writeMemory** — vkládaný kontext 461 tok: kroky 75 %, fáze (název + cíl) 17 %
- **done** — vkládaný kontext 77 tok: fáze (název + cíl) 100 %

_Vygenerováno 2026-05-30T05:11:28.797Z · reprezentativní fáze: 41._
