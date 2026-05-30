---
description: mini — přehled existující codebase do .mini/codebase.md (doplněk)
---

Tohle je krok **audit** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash `mini audit` — projde existující kód a vytvoří/aktualizuje `.mini/codebase.md` (přehled codebase pro pozdější session). Po dokončení stručně shrň výsledek uživateli v chatu. Stav fází v `.mini/state.json` to nijak nemění — typicky se pouští hned po `/mini:init` v existujícím projektu, klidně po `/mini:map`.
