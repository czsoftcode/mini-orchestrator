---
description: mini — založ nový projekt (otázky proběhnou v session)
---

Tohle je krok **init** workflow mini, spuštěný přímo v Claude Code. Založíš nový mini projekt v aktuálním adresáři. Stav v `.mini/` vznikne příkazem `mini init --apply …` — nikdy nezapisuj `.mini/state.json` ani `.mini/project.md` ručně.

Postupuj v tomhle pořadí:

1. **Zeptej se uživatele** na čtyři věci (krátké odpovědi, v chatu):
   - **název projektu** (když nic neřekne, nech default = název adresáře),
   - **co staví** (1-2 věty),
   - **pro koho to je** (cílový uživatel),
   - **hlavní omezení** (jazyk/framework/deadline — může nechat prázdné).
2. **Ulož projekt.** Spusť v Bash:
   `mini init --apply --name "<název>" --what "<co>" --for-whom "<pro koho>" --constraints "<omezení>"`
   (`--name` a `--constraints` můžeš vynechat, když je uživatel nechal prázdné). Když příkaz ohlásí, že projekt už existuje, a uživatel **potvrdí** přepsání (stará historie fází se ztratí), zopakuj příkaz s `--force`. Bez potvrzení se zastav.
3. **Nabídni další kroky.** Z výstupu příkazu poznáš, jestli je v adresáři už nějaký kód (brownfield):
   - **je tam kód** → nabídni uživateli `/mini:map` (graf projektu) a po něm `/mini:audit` (přehled codebase do `.mini/codebase.md`),
   - **prázdný adresář** → nabídni `/mini:next` (navrhnout první fázi).

Výstup příkazu a doporučené další kroky stručně předej uživateli v chatu.
