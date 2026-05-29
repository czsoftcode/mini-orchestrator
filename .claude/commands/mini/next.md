---
description: mini — navrhni a ulož další fázi projektu
argument-hint: [volitelný nápad na fázi]
---

Tohle je krok **next** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash `mini context next $ARGUMENTS` a postupuj **přesně** podle vypsaných instrukcí. Prompt obsahuje aktuální kontext projektu i to, jak na konci uložit stav (přes `mini ... --apply`). Stav v `.mini/` měň jen těmi příkazy — nikdy needituj `.mini/state.json` ručně.
