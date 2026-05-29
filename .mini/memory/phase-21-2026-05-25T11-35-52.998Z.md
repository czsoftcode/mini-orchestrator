# Fáze 21 — Report označí změny k ručnímu ověření

**Cíl:** Report fáze umí pole `verify` (seznam bodů, které Claude sám neověřil — typicky UI/UX), a `mini done` tyto body před uzavřením fáze zobrazí a v auto módu si vyžádá potvrzení člověka, místo aby fázi rovnou označil za hotovou.

## Kroky
- [hotovo] parseRunReport čte volitelné pole verify (title+detail)
- [hotovo] buildAutoPhasePrompt doplní instrukce a vzor verify
- [hotovo] done.ts zobrazí verify body a ptá se pass/skip/issue/block
- [hotovo] issue zastaví uzavření, block vytvoří podfázi s float ID
- [hotovo] advanceToNextPhase korektně posune na vloženou podfázi
- [hotovo] Testy parseru verify, done flow a vložení podfáze

## Auto-commit
- Fáze 21: Report označí změny k ručnímu ověření (`e27fb6a7911ad16d21c0e56ee68b95c27ed67b89`)

## Diskuse
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

## Run report
---
phase: 21
verdict: done
steps:
  - title: "parseRunReport čte volitelné pole verify (title+detail)"
    status: done
  - title: "buildAutoPhasePrompt doplní instrukce a vzor verify"
    status: done
  - title: "done.ts zobrazí verify body a ptá se pass/skip/issue/block"
    status: done
  - title: "issue zastaví uzavření, block vytvoří podfázi s float ID"
    status: done
  - title: "advanceToNextPhase korektně posune na vloženou podfázi"
    status: done
  - title: "Testy parseru verify, done flow a vložení podfáze"
    status: done
---

# Fáze 21 — report z auto session

## Co se povedlo

Všech šest kroků hotových. Build (`tsc`) i celá test suite (286 testů, 24 souborů) prochází.

**Parser `verify` (`src/state/runReport.ts`):**
- Nový typ `RunReportVerifyItem { title; detail? }`, přidán do `RunReport` jako povinné pole `verify` (vždy pole, default `[]`).
- Funkce `parseVerify`: chybějící/`null` pole → `[]` (zpětná kompatibilita se staršími reporty), jinak validuje seznam objektů s povinným `title` a volitelným string `detail`. Nevalidní tvar zařve `RunReportParseError`.

**Prompt (`src/prompts/autoPhase.ts`):**
- Přidána instrukce: `verify` patří věci, které Claude sám nedokázal ověřit (vizuál/UX); co jde strojově (curl, testy, build) ověří sám. Do YAML vzoru doplněn volitelný blok `verify` s `title`+`detail`.

**`done.ts`:**
- Nová `handleVerify` se volá v `applyAutoReport` až při uzavírání fáze (všechny kroky hotové). I v auto módu volá `ask()` pro každý bod — auto loop verify neobchází.
- `pass`/`skip` → fáze se uzavře normálně.
- `issue` (bez blokeru) → fázi nezavřu, vrátím `{ ok: false, reason: 'verify-issue' }`, uživatel dostane hint na opravu + `mini done`. Tím se auto loop čistě zastaví (nezacyklí se na retry).
- `block` → `insertFixSubphase` vytvoří podfázi s float ID (`nextSubphaseId`: 21 → 21.1 → 21.2, zaokrouhleno na 1 desetinné místo kvůli float aritmetice), status `planned`, kroky mechanicky z blokerů (`detail` → `notes`). Vloží se hned za rodiče v `phases` array a `advanceToNextPhase` se na ni posune. Rodičovská fáze se NEuzavírá (žádný commit/memory).

**`advanceToNextPhase`** zůstal beze změny — už dnes bere první `proposed/planned` v pořadí pole a porovnání float `===` funguje; klíčové je fyzické vložení podfáze za rodiče (řeší `insertFixSubphase`). Doplněn test, který to ověřuje.

## Poznámky / rozhodnutí k zvážení člověkem

- **Precedence při smíšených odpovědích:** když je mezi body alespoň jeden `block`, má přednost — vznikne podfáze jen z blokerů, případné `issue` body se v tom kole neřeší zvlášť (uživatel je dořeší v rámci opravné podfáze). Bez blokeru a s alespoň jedním `issue` se fáze nezavře.
- **Rodič po `block` zůstává `doing`** a `currentPhaseId` se posune na podfázi. Po dokončení podfáze `advanceToNextPhase` přeskočí rodiče (je `doing`, ne kandidát) na další fázi — rodič tedy zůstane ve stavu `doing`. Odpovídá to zadání „fáze se neuzavře", ale stojí za to ověřit, že ti tahle „osiřelá doing" fáze v praxi nevadí (případně by šlo rodiče po dokončení podfáze dozavřít — to ale fáze 21 neřeší).
- Test suite je čistě strojová; ruční vizuální průchod CLI (`mini auto` s reálnou Claude session a interaktivním výběrem pass/skip/issue/block v terminálu) jsem nespouštěl — to je přesně ten typ věci, co by patřil do `verify`.
