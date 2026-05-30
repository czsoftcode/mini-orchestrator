# Token report — cena promptů mini příkazů

Heuristika: odhad tokenů = délka textu / 4 (offline, ne přesný tokenizér Claude).
Reálný = celý prompt · Šablona = fixní text promptu · Vkládaný kontext = součet
obsahových bloků (projekt, historie fází, poznámky, …).

| Příkaz | Reálný | Šablona | Vkládaný kontext |
| --- | ---: | ---: | ---: |
| auto | 2390 | 1164 | 1226 |
| do | 1702 | 1277 | 425 |
| next | 1571 | 371 | 1200 |
| plan | 1447 | 221 | 1226 |
| discuss | 884 | 423 | 461 |
| writeMemory | 805 | 344 | 461 |
| done | 267 | 190 | 77 |

## Proč (rozpad vkládaného kontextu)

- **auto** — vkládaný kontext 1226 tok: diskuzní poznámky 62 %, kroky 28 %
- **do** — vkládaný kontext 425 tok: kroky 82 %, fáze (název + cíl) 18 %
- **next** — vkládaný kontext 1200 tok: last-memory 60 %, historie fází 37 %
- **plan** — vkládaný kontext 1226 tok: diskuzní poznámky 62 %, kroky 28 %
- **discuss** — vkládaný kontext 461 tok: kroky 75 %, fáze (název + cíl) 17 %
- **writeMemory** — vkládaný kontext 461 tok: kroky 75 %, fáze (název + cíl) 17 %
- **done** — vkládaný kontext 77 tok: fáze (název + cíl) 100 %

_Vygenerováno 2026-05-30T05:08:29.988Z · reprezentativní fáze: 41._
