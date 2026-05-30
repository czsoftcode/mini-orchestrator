# Fáze 41 — Projekt blok read-once v do

## Záměr
Zopakovat vzor z fáze 40 (diskuzní poznámky), tentokrát na blok `# Projekt`.
`buildAutoPhasePrompt` dnes inlinuje `projectMd` napevno (`autoPhase.ts:109-110`).
Přidá se opt-in příznak `useProjectRef` (default vypnuto): když `true`, místo
obsahu se vykreslí jen odkaz na `.mini/project.md` + read-once instrukce —
přesně jako `notesBlock` (`autoPhase.ts:64-66`). Cíl: ve stejné chat session
(typicky `/mini:plan` → `/mini:do`) se projekt nenačítá podruhé.

## Klíčová rozhodnutí
- **Rozsah: jen slash `/mini:do`.** Mění se `buildAutoPhasePrompt` + `do` větev
  `context.ts` (`:124-132`). `auto` (samostatná session — nemá co ušetřit) i
  headless `mini do` (jiný builder `buildDoPhasePrompt`, fáze 40 ho taky nechala
  inline) zůstávají inline = mimo rozsah.
- **`context.ts` zapíná `useProjectRef: true` pro `do` bez podmínky** — `projectMd`
  je v `do` větvi vždy načtený (čte se na začátku `context()`), na rozdíl od
  diskuzních poznámek nemůže chybět. (Pokud se ukáže potřeba symetrie s notes,
  lze podmínit na neprázdnost, ale není nutné.)
- **Refaktor šablony:** projekt je dnes inline přímo v `return` (`:109-110`),
  ne přes proměnnou — vytáhnout do `projectBlock` (analogicky `notesBlock`),
  aby šly obě větve. Heading `# Projekt` zachovat, tělo = odkaz + read-once.
- **Odkaz renderovat jako relativní** `.mini/project.md` (ne absolutní), aby šel
  z promptu otevřít. Wording zrcadlit notesBlock: „pokud jsi ho v této session
  už četl (typicky `/mini:plan` nebo začátek `auto`), znovu nenačítej; jinak
  přečti přes Read".
- **`measure.ts` doSpec:** z `blocks()` u `do` vyhodit blok `projekt` (jako se
  vyhodily diskuzní poznámky), `build` přepnout na `useProjectRef: true`, doplnit
  poznámku, že Read call se do odhadu nepočítá. Token-report rámovat jen jako
  „přegenerováno" — žádná tvrdá prahová hodnota (v tomhle repu je `project.md`
  ~35 tok, viditelně neklesne; hodnota je konzistence vzoru + úspora u velkých
  `project.md`).

## Proč ne blok „kroky"
Zvažováno (uživatel se ptal právě na blok `kroky`, co je v rozpadu skoro u
každého příkazu), ale vědomě **zamítnuto** — `kroky` je špatný kandidát na
read-once: na rozdíl od projektu/poznámek se v rámci session **mění** (`plan` je
vytvoří, `do`/`auto` přepisují statusy přes `--step-done`), je to autoritativní
pracovní artefakt s přesnými názvy pro YAML report a v jedné session (`auto`/`do`)
se stejně tiskne jednou. Fáze 41 proto míří na statický `projekt`.

## Pozor na
- Default `useProjectRef` **vypnutý** → výstup `auto` i existující snapshoty
  `autoPhase.test.ts.snap` se NESMÍ změnit.
- Nové testy: `autoPhase.test.ts` pro `useProjectRef: true` (obsahuje
  `.mini/project.md` + read-once, NEobsahuje inline text projektu; vypnutý
  příznak beze změny). `context.test.ts`: `do` větev → odkaz, ne inline projekt.
- Brána zelená: `npm run typecheck`, `npm run build`, `npm test`,
  `npm run measure-tokens` přegeneruje `.mini/token-report.md`.
- Headless `mini do` (`buildDoPhasePrompt`) a `auto` se NEMĚNÍ — jen slash `do`.
