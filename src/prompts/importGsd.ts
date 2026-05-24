export function buildImportGsdPrompt(): string {
  return `Tento adresář obsahuje rozdělaný GSD projekt v .planning/. Tvůj úkol je vytáhnout z něj kostru pro nový (jednodušší) nástroj.

Najdi tyto věci (smíš číst soubory přes Read/Glob/Grep, nezapisuj nic):
1. Krátký popis projektu — co se staví, pro koho, hlavní omezení
2. Seznam fází z roadmapu nebo z adresářové struktury, se stavem

Typické soubory v GSD: .planning/PROJECT.md, .planning/ROADMAP.md, .planning/milestones/, .planning/phases/.

Odpověz POUZE v tomto formátu, nic jiného nepiš. Každá hodnota musí být na JEDNOM řádku:

NAME: <název projektu>
WHAT: <2-3 věty o tom, co se staví — na jednom řádku>
FOR_WHOM: <pro koho, nebo "-">
CONSTRAINTS: <jazyk/framework/omezení, nebo "-">

PHASES:
1 | done | Initial setup
2 | done | Authentication
3 | doing | Profile page
4 | todo | Notifications

Pravidla pro PHASES:
- Status musí být PŘESNĚ jeden z: done, doing, todo, skipped
- Pořadí podle roadmapu, ID 1, 2, 3, … (přečísluj sekvenčně, ignoruj decimální čísla typu 1.1)
- Hotové fáze (completed, archived, finished) → done
- Rozdělané (in_progress, active) → doing
- Budoucí (pending, planned, proposed) → todo
- Zrušené (cancelled, canceled) → skipped
- Pokud nemůžeš najít roadmap, zkus odvodit fáze z adresářové struktury (každá podsložka = fáze)
`;
}
