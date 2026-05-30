---
description: mini — autonomní režim: dotáhne víc fází za sebou
argument-hint: [--max-phases N] [--yolo]
---

Tohle je krok **auto** workflow mini, spuštěný přímo v Claude Code. Jsi v **autonomním režimu**: v cyklu sám dotahuješ celé fáze (next → discuss(podmíněně) → plan → do → done) a po dokončení jedné fáze plynule pokračuješ další, dokud nenarazíš na některou z hranic běhu (viz „Konec běhu"). Stav v `.mini/` měň jen příkazy `mini ... --apply`, nikdy needituj `.mini/state.json` ručně.

## Argumenty běhu
Uživatel spustil příkaz s argumenty: `$ARGUMENTS`. Vyparsuj z nich (tolerantně, na pořadí nezáleží):
- **`--max-phases N`** — kolik fází nejvýš dotáhnout za sebou. Když chybí (nebo nejde přečíst), použij **default 1**.
- **`--yolo`** — plně bezobslužný režim (viz „Potvrzování příkazů"). Když chybí, běž v normálním režimu.

Na začátku uživateli **jednou** krátce oznam, kolik fází poběžíš a jestli je zapnutý `--yolo`.

## Cyklus jedné fáze
Pro každou fázi projdi tyto kroky po sobě (další spusť až po dokončení předchozího):

1. **next (zastav se a zeptej).** Pokud zrovna **není** rozdělaná žádná fáze (po předchozím `done`, nebo na začátku, když je poslední fáze hotová), navrhni další. Spusť `mini context next` a řiď se promptem, ale **napřed se zastav a vezmi od uživatele nápad/podklad** na další fázi (autonomní režim fáze nevymýšlí naslepo). Když `mini context next` / tvůj návrh dojde k závěru, že **projekt je hotový** (TITLE: -), cyklus čistě ukonči (viz „Konec běhu"). Je-li už fáze rozdělaná (`proposed`/`planned`/`doing`), tenhle krok přeskoč.
2. **discuss (jen podmíněně, zastav se a zeptej).** Spusť `mini context discuss` **pouze** když je fáze složitá na rozhodnutí (nejednoznačný cíl, víc směrů, potřeba něco vyjasnit) **a** diskuse pro ni ještě neproběhla; pak interaktivně seber vstup od uživatele a ulož poznámky. U přímočaré fáze discuss **přeskoč**.
3. **plan.** Spusť `mini context plan` a rozmen fázi na kroky; ulož přes `mini plan --apply`. Když už fáze kroky má, přeskoč.
4. **do (tiše).** Spusť `mini do --apply` a pak `mini context do`; implementuj fázi podle instrukcí. **Nevypisuj editační výpisy** — nepřevyprávěj každou změnu souboru do chatu, jen krátce hlas postup po krocích. Po každém hotovém kroku ho označ: `mini do --apply --step-done "<přesný název>"`. Na konci zapiš report do `.mini/run/phase-{id}.md`.
5. **done.** Spusť `mini context done` a posuň stav; finální uložení `mini done --apply`. U **bodů k ručnímu ověření (verify)** se **zastav a nech uživatele ověřit** — auto verify neobchází.

Mezi kroky i mezi fázemi uživateli krátce hlas, kam ses dostal (bez zaplavení chatu).

## Potvrzování příkazů
V **normálním** režimu necháváš potvrzování bash příkazů na uživateli (řídí ho permission mode session, příp. allowlist v `.claude/settings.json`). V režimu **`--yolo`** nemáš uživatele zatěžovat dotazy — to ale funguje jen tehdy, když session **běží v acceptEdits** (spusť Claude Code s `--permission-mode acceptEdits`, nebo to v session přepni). Slash command sám potvrzování nevypne. Když `--yolo` dostaneš, ale session v acceptEdits není, jednou na to upozorni a pokračuj normálně.

## Stop háčky (kooperativní zastavení — připraveno pro budoucí `mini stop`)
Na těchto **kontrolních bodech** ověř, jestli nemáš čistě skončit (zatím: když existuje soubor `.mini/STOP`, dokonči rozdělaný krok, zapiš report a skonči s hlášením „Zastaveno na žádost"; jinak pokračuj). Sám `mini stop` přijde v další fázi — teď jen drž tyhle body:
- **mezi kroky cyklu** — před každým dalším `mini context …` voláním,
- **po každém hotovém kroku v `do`** — hned po `mini do --apply --step-done "…"`.
(Hranice celé fáze je v tom automaticky obsažená.) Stop je nutně kooperativní — zprávu napsanou do téhle session bys během práce stejně nepřečetl; tvrdé přerušení uprostřed kroku je na Esc/Ctrl+C.

## Konec běhu
Cyklus ukonči (a krátce shrň, co se stalo), když nastane kterákoli z hranic:
- dotáhl jsi **`--max-phases`** fází,
- `next` usoudil, že **projekt je hotový**,
- narazíš na **blocker**, který sám neumíš obejít — zastav se a předej řízení uživateli (zbytek nedotahuj na sílu),
- zafungoval **stop háček**.
