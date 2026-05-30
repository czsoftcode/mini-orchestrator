# Fáze 42 — Step.detail v modelu a v plan

**Cíl:** Rozšířit Step o volitelné pole detail (kritéria/'Ověřitelné'), aby title zůstal krátký kanonický identifikátor; mini plan --apply přijme a uloží title + detail zpětně kompatibilním stdin formátem (řádek bez oddělovače = jen title) a slash /mini:plan prompt navede na krátký title + samostatný detail. Renderery promptů (auto/do/discuss/writeMemory) a párování reportu zůstávají na title beze změny. Ověřitelné: typecheck, unit testy parsování plan --apply (s detailem i bez), aktualizovaný snapshot plan promptu.

## Kroky
- [hotovo] Přidat Step.detail do typu Step
- [hotovo] Stdin parser plan --apply na title + detail
- [hotovo] applyPlanSteps a cli.ts ukládají detail
- [hotovo] Slash plan prompt: krátký title + detail

## Auto-commit
- Fáze 42: Step.detail v modelu a v plan (`99bba32893623a0bb34ccbc3def17670ae14390b`)

## Diskuse
# Fáze 42 — Step.detail v modelu a v plan

## Záměr

Úspora tokenů na bloku "kroky" (z měření `measure-tokens`: u `auto` je
"kroky" ~23 % vkládaného kontextu, a v auto promptu se tituly inlinují
DVAKRÁT — jednou jako vodítko "Kroky", podruhé naklonované ve vzorovém
YAML reportu `sampleSteps`).

Kořenová příčina: `Step` má jen `{ title, status }`, takže `title` dělá
dvě role najednou — (1) **kanonický identifikátor** pro párování reportu
↔ stav (`runReport.ts:207`, přesná shoda množin titulů) a (2) **nositel
kritérií** ("Ověřitelné: …"). Slash `/mini:plan` (`sessionContext.ts:122`)
délku titulu nelimituje, proto se ustálily ~250znakové tituly (viz fáze 41)
a každé jejich opakování je drahé.

Zvolený směr (dohodnuto s uživatelem): role **rozdělit** — krátký `title`
(identifikátor) + volitelný `Step.detail` (kritéria). Pak report páruje
krátký title (levný klon, problém duplikace se skoro vypaří) a `detail` se
vykreslí jen jednou v sekci Kroky pro `do`/`auto`. Celý split je vícedenní,
proto je fáze 42 jen **první kus = datový základ + zápis přes plan**.

## Klíčová rozhodnutí

- **Rozsah fáze 42 = jen plumbing.** Přidat `detail?: string` do `Step`,
  naučit `mini plan --apply` ho parsovat a uložit, a navést slash plan prompt
  na formát "krátký title + samostatný detail". Renderery promptů
  (autoPhase/doPhase/discuss/writeMemory) a parser reportu se v této fázi
  **NEMĚNÍ** — `detail` se zatím jen ukládá. To drží fázi malou a bezpečnou.
- **Zpětná kompatibilita stdin formátu `plan --apply`.** Dnes = jeden title
  na řádek. Nový formát musí být nadmnožina: řádek bez oddělovače = jen title
  (detail prázdný). Přesný oddělovač zvolit v plan/do (návrh: `title :: detail`
  nebo druhý sloupec) — musí být odolný vůči dvojtečkám v textu titulu.
- **Staré fáze nemigrovat.** Existující fáze mají dlouhý "Ověřitelné" ocas
  rovnou v `title`; necháme je být. Nové fáze dostanou split. Žádná migrace
  v této fázi.
- **Slash `/mini:plan` prompt** navést na krátký title (cca ≤ 8 slov, ať se
  sjednotí s headless `buildPlanPhasePrompt`) + volitelný detail, a popsat
  nový stdin formát příkazu `mini plan --apply`.

## Pozor na

- `runReport.ts:207-220` páruje report ↔ stav **přesnou shodou množin titulů**.
  Dokud zůstává párování na `title` (a tato fáze ho nemení), nesmí se rozbít.
- Báze pro navazující fáze (mimo rozsah 42, ale ať plan/do ví, kam to směřuje):
  1) vykreslit `detail` v sekci "Kroky" auto/do promptu (a `measure.ts`
     `stepsText` o detail rozšířit, ať měření odpovídá realitě),
  2) udržet klon ve `sampleSteps` jen na `title` (už dnes klonuje jen title —
     takže s krátkými tituly je duplikace levná; původní "fáze 42 dedup" se tím
     stává skoro zbytečnou),
  3) případná migrace/zkrácení starých titulů — volitelné.
- Testy/snapshoty: `Step` je v `state/types.ts`; změna parsování v
  `commands/plan.ts` (`--apply` větev, `:179`); plan prompt v
  `prompts/sessionContext.ts` má snapshot `__snapshots__/planPhase.test.ts.snap`
  resp. test v `sessionContext.test.ts` — počítat s jejich aktualizací.
- Brána zelená: `npm run typecheck`, `npm test` (nové unit testy parsování
  `plan --apply` s detailem i bez), `npm run build`.

## Run report
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
