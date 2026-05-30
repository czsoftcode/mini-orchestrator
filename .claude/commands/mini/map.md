---
description: mini — přegeneruj graf projektu (doplněk)
---

Tohle je krok **map** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash `mini map` — přegeneruje graf projektu (`.mini/graph/` + index `.mini/graph.json`) ze zdrojáků. Výsledek (cestu indexu a počet zmapovaných souborů) z výstupu předej uživateli v chatu. Stav fází v `.mini/state.json` to nijak nemění — graf je jen derivace ze zdrojáků.
