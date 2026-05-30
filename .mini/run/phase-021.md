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
