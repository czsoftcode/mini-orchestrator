---
phase: 42
verdict: done
steps:
  - title: "Přidat Step.detail do typu Step"
    status: done
  - title: "Stdin parser plan --apply na title + detail"
    status: done
  - title: "applyPlanSteps a cli.ts ukládají detail"
    status: done
  - title: "Slash plan prompt: krátký title + detail"
    status: done
---

# Fáze 42 — report z auto session

Datový základ pro rozdělení `Step` na krátký `title` + samostatný `detail` je
hotový. Vše ověřeno strojově (typecheck, 452 testů, build) — nic k ručnímu
ověření.

## Co se udělalo

- **`Step.detail`** (`state/types.ts`) — nové volitelné pole vedle existujícího
  `notes`. Doplnil jsem doc komentář, který oba odlišuje: `detail` = plánovací
  záměr/„Ověřitelné" (statický), `notes` = runtime poznámka (např. detail
  blokeru z `done` → opravná podfáze). Záměrně oddělené, ne sloučené do `notes`.
- **Parser `parseStepsFromStdin`** (`commands/plan.ts`) — vrací `ParsedStep[]`
  (`{ title, detail? }`) místo `string[]`. Oddělovač ` :: ` (mezery kolem `::`
  ho dělají odolným vůči samostatným dvojtečkám v textu). Zpětně kompatibilní:
  řádek bez oddělovače = jen title. Strhávání prefixů (`STEP:`, `- `, `1.`)
  zůstává a funguje i s oddělovačem na stejném řádku.
- **`applyPlanSteps` + `cli.ts`** — signatura přijímá `ParsedStep[]`, do `Step`
  uloží `detail` jen když je neprázdný (prázdný/whitespace se vynechá). `cli.ts`
  napojeno, popisek `--apply` zmiňuje nový formát.
- **Slash plan prompt** (`buildPlanSessionPrompt`) — navádí na krátký `title`
  (≤ ~8 slov, kanonický identifikátor) + volitelný `detail` (ověřitelná
  kritéria) a dokumentuje stdin formát `title :: detail`.

## Pozor / poznámky

- **Renderery a parser reportu se NEMĚNILY** (dle rozsahu fáze) — `detail` se
  zatím jen ukládá, nikde se nevykresluje. Vykreslení `detail` v sekci „Kroky"
  auto/do promptu + rozšíření `measure.ts` `stepsText` je navazující fáze.
  Teprve tam se projeví slíbená úspora na bloku „kroky".
- **Drobná ironie:** plan prompt se prodloužil (měřená šablona `plan`
  221→362 tok ve fixních vstupech `measure.test.ts`), protože přibyl návod ke
  dvoudílnému formátu. Je to jednorázový fixní náklad šablony; úspora přijde
  plošně v dalších fázích, až budou tituly krátké.
- **Edge case oddělovače:** `trim()` smaže koncovou mezeru, takže visící
  oddělovač `title ::` (prázdný detail) ` :: ` netrefí — ošetřeno zvlášť
  (`endsWith(' ::')` → jen title). Vedoucí prázdný title (`:: detail`) je přes
  trim nedosažitelný, guard je tam jen defenzivně.
- `.mini/token-report.md` jsem nepřegeneroval — cíl fáze to nevyžaduje a
  renderery „kroků" se neměnily (plan šablona by se posunula, ale to není
  předmět této fáze).

## Ověřeno strojově

- `npm run typecheck` — zelený
- `npm test` — 452 testů zelených (nové: 5× parser title/detail, 1× ukládání
  detailu v applyPlanSteps, 1× plan prompt navádí na formát)
- `npm run build` — zelený
- snapshot `measure.test.ts` aktualizován (posun jen u `plan`, vkládaný kontext
  beze změny)
