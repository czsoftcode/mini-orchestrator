# Fáze 21 — Report označí změny k ručnímu ověření

## Záměr

Do run reportu přibyde volitelné pole `verify` — seznam věcí, které Claude sám neověřil
(UI/UX, ale obecně cokoliv, co nejde strojově otestovat). `mini done` toto pole při
závěrečném uzavření fáze zobrazí a vyzve uživatele k odpovědi na každý bod.
Výsledek určí, jestli se fáze uzavře, pozastaví, nebo vznikne opravná podfáze.

## Klíčová rozhodnutí

**Formát `verify` v YAML reportu:**
Strukturovaný objekt — každá položka má `title` (povinné) a `detail` (volitelné).
```yaml
verify:
  - title: Ověř, že tlačítko funguje na mobilu
    detail: Testováno pouze curl, vizuální stav neznámý
```

**Odpovědi na verify body — `pass | skip | issue | block`:**
- `pass` — ověřeno, vše ok → fáze se uzavře normálně
- `skip` — uživatel přeskočil ověření (bere zodpovědnost na sebe) → fáze se uzavře
- `issue` — drobný problém → uzavření fáze se zastaví, uživatel dostane instrukce
  co opravit a spustit (`mini do` na opravu, pak znovu `mini done`)
- `block` — závažný bloker → fáze se neuzavře, automaticky se vytvoří opravná podfáze

**Podfáze pro `block`:**
- Číslování: float ID (21.1, 21.2...) — `id: number` s floaty, JavaScript to zvládne
- Podfáze se vloží hned za mateřskou fázi v `phases` array
- Steps se sestaví mechanicky z bloker verify items (každý blocker → jeden step),
  podfáze dostane status `planned` — bez dalšího Claude API volání
- Uživatel dostane instrukce: spusť `mini do` (podfáze je připravena)

**Kdy se verify zobrazí:**
Při závěrečném uzavření fáze — po posledním kroku, ne per-krok.

**Auto mód:**
Stejný flow jako interaktivní, ale `mini done` zastaví auto iteraci a čeká na
vstup uživatele (volání `ask()`). Auto loop se nepokouší obejít verify.

**Prompt (`buildAutoPhasePrompt`):**
Přidat instrukce pro Claude: `verify` patří věci, které Claude nedokáže sám ověřit.
Co jde strojově (curl, testy, build), ověří Claude sám. Co vyžaduje lidský pohled
(vizuální UI, UX flow, subjektivní dojem), zapíše do `verify`.

## Pozor na

- **Třídění fází s float ID**: `advanceToNextPhase` bere první `proposed/planned` fázi
  v `phases` array. Podfáze musí být vloženy fyzicky za mateřskou fázi, ne na konec
  pole — jinak by se přeskočily.
- **`currentPhaseId: number | null`** — při posunu na podfázi musí `advanceToNextPhase`
  korektně vrátit 21.1 (float), porovnání `===` funguje.
- **Nulové kroky**: fáze bez steps — `verify` flow funguje stejně, steps array je prázdné.
- **Parser `parseRunReport`**: `verify` je volitelné — chybějící pole = prázdný seznam,
  workflow se nemění (zpětná kompatibilita se staršími reporty).
- **Kde se verify zobrazuje**: jen při uzavírání fáze v `done.ts` — ne v `status`,
  ne při retry. Retry (`auto` loop) na verify nenaráží, to řeší samotné `done()`.
