# Fáze 8 — Poznámky z diskuse pro `mini plan` a `mini do`

## Záměr
Po `mini discuss` se nyní ztrácí všechen kontext kromě upraveného `title`/`goal` — `mini plan` a `mini do` pak jedou naslepo. Cílem fáze je uložit shrnutí diskuse do markdown souboru, který následující kroky workflow vlepí do svých promptů. Diskuse zůstává **nepovinná** — hodí se jen u složitějších fází.

## Klíčová rozhodnutí
- **Úložiště:** `.mini/discuss/phase-{id}.md` (volný markdown, žádné schéma, žádná validace).
- **Struktura souboru** (fixní názvy sekcí, sekce může být prázdná nebo úplně chybět):
 ```
  # Fáze {id} — {title}

  ## Záměr
  ## Klíčová rozhodnutí
  ## Pozor na
 ```
- **Zápis:** dělá Claude sám na konci `mini discuss` session přes `Write` tool — proto se musí `Write` přidat do `DISCUSS_ALLOWED_TOOLS` v `src/commands/discuss.ts:9`.
- **Instrukce v promptu:** `buildDiscussPhasePrompt` v `src/prompts/discussPhase.ts` musí na konci říct: „Když diskusi uzavřeš, zapiš `.mini/discuss/phase-{id}.md` v této struktuře a teprve pak ukonči session."
- **Čtení v `plan` i `do`:** `buildPlanPhasePrompt` (`src/prompts/planPhase.ts`) i `buildDoPhasePrompt` (`src/prompts/doPhase.ts`) si soubor přečtou (pokud existuje) a vlepí ho do promptu pod nadpis `#Poznámky k fázi (z diskuse)`. Pokud soubor neexistuje, sekce se vynechá — bez chyby, bez warningu v promptu.
- **Mini soubor nikdy sám nezapisuje** — pouze čte. Veškerou tvorbu obstará Claude (nebo uživatel ručně).
- **Uživatel smí editovat / mazat** kdykoli — žádný lock, žádná validace.
- **Po skončení `mini discuss`:** mini ověří, jestli soubor vznikl. Pokud ne, jen `log.dim`-style zpráva typu „Poznámky nebyly uloženy — diskuse se neuloží." Není to chyba (uživatel mohl session přerušit).

## Pozor na
- **Nepleť si fázi 8 a 9.** Fáze 9 (původně 8) = „jeden Claude run pro celou fázi". Tahle fáze (8) tomu jen připravuje půdu — bez ní by fáze 9 jela naslepo.
- **Discuss má dnes read-only allowedTools** (`['Read','Grep','Glob','LS']`). Přidání `Write` mírně oslabuje izolaci diskusní session. Akceptujeme: riziko, že Claude napíše mimo `.mini/discuss/`, je malé a v promptu mu cestu explicitně dáváme.
- **Tests:** `discussPhase.test.ts`, `doPhase.test.ts`, `planPhase.test.ts` mají snapshoty v `src/prompts/__snapshots__/`. Po úpravě promptů snapshoty padnou — projet ručně a regenerovat.
- **README:** v sekci „Soubory v projektu" doplnit `.mini/discuss/phase-{id}.md`; v popisu `mini discuss` zmínit, že se ukládá shrnutí.
- **`mini status`** případně může v budoucnu indikovat „má poznámky / nemá poznámky", ale **do scope této fáze to nepatří**.
- **Co když fáze nemá `id`?** Nepřípadné — `Phase.id` je vždy přítomen (`src/state/types.ts:12`).
- **Adresář `.mini/discuss/`** musí vzniknout — buď ho vytvoří `mini discuss` před spuštěním Clauda, nebo to Claude udělá sám přes `Write` (mkdir -p ekvivalent). Bezpečnější je první varianta.
- **Holding pattern v `mini auto`:** auto dneska discuss vůbec nevolá. Tahle fáze to nemění — auto zůstane bez diskuse.

