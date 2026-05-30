# Fáze 65 — Autonomní režim mini:auto

**Cíl:** mini:auto poběží autonomně: v cyklu sám spouští celé fáze (next → plan → příp. discuss → do → done) a sám rozhoduje, kdy je potřeba diskuze. Interaktivně se ptá jen na nezbytná rozhodnutí, nevypisuje editační výpisy a neběží s potvrzováním příkazů. Hotovo = auto dotáhne několik fází za sebou bez ručních zásahů. Vzhledem k náročnosti návrhu (hranice autonomie, rozhodovací logika) se chování nejdřív rozmyslí v mini:discuss.

## Kroky
- [hotovo] Přepsat auto definici v COMMAND_DEFS — smyčka přes víc fází
- [hotovo] Tělo auto.md — interaktivní zastávky a tichý běh
- [hotovo] Tělo auto.md — stop háčky pro budoucí fázi 66
- [hotovo] Permissions — settings.json allowlist a --yolo dokumentace
- [hotovo] Testy, regenerace a README

## Auto-commit
- Fáze 65: Autonomní režim mini:auto (`d460c26294b290a14e3a262cc8d023d5fd65fe30`)

## Diskuse
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

## Run report
---
phase: 65
verdict: done
steps:
  - title: "Přepsat auto definici v COMMAND_DEFS — smyčka přes víc fází"
    status: done
  - title: "Tělo auto.md — interaktivní zastávky a tichý běh"
    status: done
  - title: "Tělo auto.md — stop háčky pro budoucí fázi 66"
    status: done
  - title: "Permissions — settings.json allowlist a --yolo dokumentace"
    status: done
  - title: "Testy, regenerace a README"
    status: done
verify:
  - title: "Reálný běh /mini:auto --max-phases 2 v Claude Code"
    detail: "Změny jsou v textu slash commandu (auto.md) + allowlistu — strojově ověřeno testy a buildem, ale skutečné chování autonomní smyčky (zastávky u next/discuss/verify, tichý běh, konec po N fázích) jde potvrdit jen reálným spuštěním /mini:auto v session. Doporučuju zkusit --max-phases 2 na nějaké malé fázi."
---

# Fáze 65 — report z auto session

## Co se udělalo
Rozšířen slash command `/mini:auto` na **autonomní režim** přes víc fází. Klíčové zjištění: `auto.md` se negeneruje ručně, je to výstup z `COMMAND_DEFS` v `src/commands/install-commands.ts` — měnila se tedy definice tam a `.claude/commands/mini/auto.md` se přegeneroval přes `install-commands`.

Konkrétně:
- **`src/commands/install-commands.ts`** — nová `auto` definice: `argumentHint: '[--max-phases N] [--yolo]'`, tělo popisuje autonomní smyčku `next → discuss(podmíněně) → plan → do → done → opakuj`, parsování `--max-phases` (default 1) a `--yolo` z `$ARGUMENTS`, interaktivní zastávky (next/discuss/verify), tichý běh u `do`, detekci hotového projektu (TITLE: -), čtyři hranice konce běhu a **stop háčky** (kontrola `.mini/STOP` mezi kroky cyklu i po každém `--step-done`) jako příprava pro fázi 66.
- **`.claude/settings.json`** (nový) — allowlist pro `mini:*`, build/test (`npm run build/test`, `npx vitest`) a běžné git příkazy, aby autonomní běh neotravoval s potvrzováním.
- **`src/commands/install-commands.test.ts`** — přejmenovaný stávající auto test (next přidán do sekvence) + 2 nové testy: argument-hint/`--max-phases`/`--yolo`/tichý běh/TITLE:- a stop háčky.
- **`README.md`** — nová sekce „Autonomní `/mini:auto`" + doplnění slash command přehledu o auto/map/status.
- Přegenerován `.claude/commands/mini/auto.md` přes `node dist/cli.js install-commands`.

## Ověřeno strojově
- Celá test suite: **627 passed, 0 failed** (174 suites).
- `npm run build` (tsc + copy-assets) prošel.
- `auto.md` má správný frontmatter (description + argument-hint) a obsahuje `--max-phases`, `--yolo`, `.mini/STOP`, `TITLE: -`.

## Pozor na / otevřené konce
- **Permissions v slash režimu:** `.claude/settings.json` allowlist potlačí potvrzování jen pro vyjmenované příkazy. `--yolo` reálně funguje jen v session spuštěné s `--permission-mode acceptEdits` — slash command sám potvrzování nevypne. Zdokumentováno v auto.md i README.
- **Stop je zatím jen dokumentovaný háček** — `.mini/STOP` se nikde nezapisuje. Samotný `mini stop` (CLI) je naplánovaný jako fáze 66.
- **CLI `mini auto` (Node) zůstalo beze změny** — pořád dotahuje jednu fázi přes spawn Clauda. Slash a CLI varianta jsou teď záměrně oddělené (popsáno v README). Případné sjednocení je mimo scope.
