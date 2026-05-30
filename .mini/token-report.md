# Token report — cena promptů mini příkazů

Heuristika: odhad tokenů = délka textu / 4 (offline, ne přesný tokenizér Claude).
Reálný = celý prompt · Šablona = fixní text promptu · Vkládaný kontext = součet
obsahových bloků (projekt, historie fází, poznámky, …).

| Příkaz | Reálný | Šablona | Vkládaný kontext |
| --- | ---: | ---: | ---: |
| auto | 2102 | 870 | 1232 |
| next | 1471 | 373 | 1098 |
| plan | 1367 | 135 | 1232 |
| do | 1342 | 983 | 359 |
| discuss | 591 | 196 | 395 |
| writeMemory | 512 | 117 | 395 |
| done | 267 | 183 | 84 |

## Proč (rozpad vkládaného kontextu)

- **auto** — vkládaný kontext 1232 tok: diskuzní poznámky 68 %, kroky 22 %
- **next** — vkládaný kontext 1098 tok: last-memory 53 %, historie fází 43 %
- **plan** — vkládaný kontext 1232 tok: diskuzní poznámky 68 %, kroky 22 %
- **do** — vkládaný kontext 359 tok: kroky 77 %, fáze (název + cíl) 23 %
- **discuss** — vkládaný kontext 395 tok: kroky 70 %, fáze (název + cíl) 21 %
- **writeMemory** — vkládaný kontext 395 tok: kroky 70 %, fáze (název + cíl) 21 %
- **done** — vkládaný kontext 84 tok: fáze (název + cíl) 100 %

_Vygenerováno 2026-05-30T07:09:43.918Z · reprezentativní fáze: 44._
