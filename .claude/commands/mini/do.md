---
description: mini — implementuj aktuální fázi a zapiš report
---

Tohle je krok **do** workflow mini, spuštěný přímo v Claude Code. Implementuješ aktuální fázi a na konci zapíšeš report. Stav v `.mini/` měň jen příkazy `mini ... --apply`, nikdy needituj `.mini/state.json` ručně.

Postupuj v tomhle pořadí:

1. **Nastartuj fázi.** Spusť v Bash `mini do --apply` — fázi to označí jako rozdělanou (`doing`) a založí `.mini/run/`, aby měl průběžný zápis kroků i report kam směřovat. Spusť to **dřív**, než začneš implementovat.
2. **Načti prompt.** Spusť `mini context do` a řiď se vypsanými instrukcemi (kontext projektu, kroky, formát reportu).
3. **Implementuj.** Po každém dokončeném kroku ho **hned** označ za hotový: `mini do --apply --step-done "<přesný název kroku>"` (název kopíruj znak po znaku ze sekce „Kroky" v promptu).
4. **Zapiš report.** Na konci přes Write tool ulož report do `.mini/run/phase-{id}.md` přesně podle formátu z promptu (YAML statusy + volný text). Teprve potom skonči.

Když některý krok narazí na blocker, který sám neumíš obejít, zastav se a předej řízení uživateli.
