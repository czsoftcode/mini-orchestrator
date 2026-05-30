# Fáze 65 — Autonomní režim mini:auto

## Záměr
Rozšířit `/mini:auto` tak, aby autonomně dotáhl **víc fází za sebou**, ne jen jednu.
Dnes `/mini:auto` (slash, řízený Claudem) jede jednu fázi: discuss(podmíněně) → plan → do → done.
Nově se na začátek přidá **next** (návrh další fáze) a celé se to **zacyklí** přes víc fází.
Režim je **semi-autonomní**: mechanické kroky (plan, do, done) běží bez zbytečného vyptávání a bez
převyprávění editací, ale u kroků, kde je potřeba vstup od člověka (next, discuss, verify), se zastaví a zeptá.

## Klíčová rozhodnutí
- **Architektura: slash `/mini:auto` řízený Claudem.** Celý cyklus běží v jedné Claude session
  (volá `mini context next/discuss/plan`, `mini do/done --apply`). NE rozšiřovat Node smyčku v
  `src/commands/auto.ts` ani nespawnovat sub-Claude. → mění se hlavně `.claude/commands/mini/auto.md`.
- **Rozsah běhu: `--max-phases N`, default 1.** Cyklus udělá až N fází a skončí. Předává se přes
  `$ARGUMENTS` slash commandu. Default 1 = bezpečné chování blízké dnešku; víc fází na vyžádání.
- **Smyčka přes fáze:** po `done` jedné fáze (pokud se posunula a ještě nevyčerpán `--max-phases`)
  pokračovat dalším `next`. Skončit když: vyčerpán limit, Claude usoudí „projekt hotový", nebo blocker.
- **Interaktivní zastávky (semi-autonomní, NE bezobslužné):**
  - `next` — zastavit a vzít od člověka nápad/podklad k další fázi (jinak by autonomně navrhoval naslepo).
  - `discuss` — spustit **podmíněně** (jen u složité/nejednoznačné fáze) a interaktivně sebrat vstup od člověka.
  - `verify` body v `done` — zastavit a nechat člověka ověřit (chování jako dnes, žádný auto-pass).
- **Tichý běh:** Claude u `do` **nevypisuje editační výpisy** (nepřevypráví každou změnu souboru),
  jen krátce hlásí postup po fázích/krocích.
- **Permissions (potvrzování bash příkazů):** konfigurovatelné — default běží normálně (spoléhá na
  permission mode session / allowlist), volitelný `--yolo` = běžet bez ptaní.

## Stop háčky (příprava pro budoucí mini:stop ve fázi 66)
- **Samotný `mini stop` NENÍ součástí fáze 65** — přijde ve fázi 66 (CLI příkaz, který zapíše/čte
  stop flag, např. `.mini/STOP`). Fáze 65 jen **připraví místa ve smyčce, kde se stop bude kontrolovat.**
- **Granularita kontroly: krok cyklu + krok v `do`.** Smyčka v `auto.md` má mít definované body, kde
  by se stop dal vyhodnotit:
  1. **mezi kroky cyklu** — mezi jednotlivými `mini context next/discuss/plan/do/done` voláními,
  2. **po každém hotovém kroku uvnitř `do`** — tam, kde se volá `mini do --apply --step-done "…"`.
  (Hranice celé fáze je v tomhle automaticky obsažená.)
- **Pozn. k mechanismu:** stop je nutně **kooperativní** — slash command napsaný do téže session
  Claude nepřečte, dokud pracuje. `mini stop` se pak (fáze 66) bude spouštět z jiného terminálu a
  zapíše flag; smyčka ho na nejbližší z výše uvedených hranic uvidí a čistě skončí. Tvrdé přerušení
  uprostřed běžícího kroku zůstává na Esc/Ctrl+C.
- **Úkol pro fázi 65:** v `auto.md` tyto kontrolní body **explicitně popsat** (i kdyby zatím jen jako
  „pokud existuje stop flag, čistě skonči") tak, aby fáze 66 doplnila jen zápis/čtení flagu a nemusela
  přepisovat řídicí logiku.

## Pozor na
- **Permission prompty v slash režimu:** slash command (markdown) sám **nevypne** potvrzování bash
  příkazů harnessu — to řídí permission mode session (acceptEdits/bypassPermissions) nebo allowlist
  `mini`/build příkazů v `.claude/settings.json`. `--yolo` proto v slash režimu znamená spíš
  „instrukce + předpoklad, že session běží v acceptEdits", ne reálné přepnutí. **Vyřešit v plánu:**
  buď (a) přidat `mini *` + build/test příkazy do `.claude/settings.json` allowlist, a/nebo
  (b) v auto.md zdokumentovat, že pro plně tichý běh má uživatel pustit session v acceptEdits.
- **`--max-phases` a `--yolo` jako `$ARGUMENTS`:** slash command dostává volný text; parsování N
  (a `--yolo`) musí být tolerantní (default 1, když nic nezadáno).
- **Konzistence s existující Node `mini auto`:** zůstává jako alternativní (spawn) cesta — nerozbít ji.
  Tahle fáze cílí na slash variantu; rozmyslet, jestli a jak se chování obou má sjednotit (nebo to
  explicitně nechat oddělené).
- **Detekce „projekt hotový":** `mini context next` umí vrátit, že projekt je hotový (TITLE: -).
  Smyčka to musí poznat a čistě skončit, ne navrhovat prázdnou fázi.
- **Hlášení postupu:** mezi fázemi krátce hlásit uživateli, u které fáze jsme a co se stalo
  (aby semi-autonomní běh byl srozumitelný), ale bez zaplavení chatu.
