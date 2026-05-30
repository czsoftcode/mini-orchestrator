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
