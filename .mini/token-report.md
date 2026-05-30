# Token report — cena promptů mini příkazů

Heuristika: odhad tokenů = délka textu / 4 (offline, ne přesný tokenizér Claude).
Reálný = celý prompt · Šablona = fixní text promptu · Vkládaný kontext = součet
obsahových bloků (projekt, historie fází, poznámky, …).

| Příkaz | Reálný | Šablona | Vkládaný kontext |
| --- | ---: | ---: | ---: |
| auto | 1924 | 852 | 1072 |
| next | 1466 | 372 | 1094 |
| do | 1265 | 965 | 300 |
| plan | 1259 | 187 | 1072 |
| discuss | 587 | 251 | 336 |
| writeMemory | 507 | 171 | 336 |
| done | 269 | 179 | 90 |

## Proč (rozpad vkládaného kontextu)

- **auto** — vkládaný kontext 1072 tok: diskuzní poznámky 69 %, kroky 20 %
- **next** — vkládaný kontext 1094 tok: last-memory 54 %, historie fází 43 %
- **do** — vkládaný kontext 300 tok: kroky 70 %, fáze (název + cíl) 30 %
- **plan** — vkládaný kontext 1072 tok: diskuzní poznámky 69 %, kroky 20 %
- **discuss** — vkládaný kontext 336 tok: kroky 63 %, fáze (název + cíl) 27 %
- **writeMemory** — vkládaný kontext 336 tok: kroky 63 %, fáze (název + cíl) 27 %
- **done** — vkládaný kontext 90 tok: fáze (název + cíl) 100 %

_Vygenerováno 2026-05-30T06:33:33.998Z · reprezentativní fáze: 43._
