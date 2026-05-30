# Fáze 41 — Projekt blok read-once v do

**Cíl:** buildAutoPhasePrompt dostane opt-in příznak useProjectRef (default vypnuto); /mini:do místo inlinování project.md vykreslí relativní odkaz .mini/project.md + read-once instrukci (auto zůstává inline). Ověřitelné aktualizovanými snapshot/unit testy a přegenerovaným token-reportem.

## Kroky
- [hotovo] Builder buildAutoPhasePrompt: přidat opt-in příznak useProjectRef?: boolean (default vypnuto) do AutoPhaseContext; projekt vytáhnout z inline return (autoPhase.ts:109-110) do proměnné projectBlock — když true, vykreslit pod nadpisem '# Projekt' relativní odkaz .mini/project.md + read-once instrukci (zrcadlit notesBlock); když false/neuvedeno → dnešní inline větev beze změny. Ověřitelné: npm run typecheck zelený, funkce přijímá nový příznak.
- [hotovo] Unit testy builderu v autoPhase.test.ts: nové testy pro useProjectRef: true (výstup obsahuje .mini/project.md + read-once formulaci a NEobsahuje inline text projektu); při vypnutém příznaku se výstup nemění. Ověřitelné: npm test zelené, existující snapshoty autoPhase.test.ts.snap beze změny.
- [hotovo] context.ts (větev do) přepnout na referenci + test v context.test.ts: do větev (:124-132) nastaví useProjectRef: true. Nový test: /mini:do → výstup má odkaz .mini/project.md + read-once, ne inline projekt. Ověřitelné: npm test zelené, nový context test.
- [hotovo] measure.ts doSpec → reference mód: z blocks() u do vyhodit blok projekt, build přepnout na useProjectRef: true, doplnit poznámku že Read call se nepočítá. Brána + přegenerování: npm run typecheck, npm run build, npm test zelené a npm run measure-tokens přegeneruje .mini/token-report.md (bez tvrdé prahové hodnoty). Ověřitelné: brána zelená, report přegenerován.

## Auto-commit
- Fáze 41: Projekt blok read-once v do (`133b1e4b5f9dc03458e1041e80b899b79e70373b`)

## Diskuse
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

## Run report
---
phase: 41
verdict: done
steps:
  - title: "Builder buildAutoPhasePrompt: přidat opt-in příznak useProjectRef?: boolean (default vypnuto) do AutoPhaseContext; projekt vytáhnout z inline return (autoPhase.ts:109-110) do proměnné projectBlock — když true, vykreslit pod nadpisem '# Projekt' relativní odkaz .mini/project.md + read-once instrukci (zrcadlit notesBlock); když false/neuvedeno → dnešní inline větev beze změny. Ověřitelné: npm run typecheck zelený, funkce přijímá nový příznak."
    status: done
  - title: "Unit testy builderu v autoPhase.test.ts: nové testy pro useProjectRef: true (výstup obsahuje .mini/project.md + read-once formulaci a NEobsahuje inline text projektu); při vypnutém příznaku se výstup nemění. Ověřitelné: npm test zelené, existující snapshoty autoPhase.test.ts.snap beze změny."
    status: done
  - title: "context.ts (větev do) přepnout na referenci + test v context.test.ts: do větev (:124-132) nastaví useProjectRef: true. Nový test: /mini:do → výstup má odkaz .mini/project.md + read-once, ne inline projekt. Ověřitelné: npm test zelené, nový context test."
    status: done
  - title: "measure.ts doSpec → reference mód: z blocks() u do vyhodit blok projekt, build přepnout na useProjectRef: true, doplnit poznámku že Read call se nepočítá. Brána + přegenerování: npm run typecheck, npm run build, npm test zelené a npm run measure-tokens přegeneruje .mini/token-report.md (bez tvrdé prahové hodnoty). Ověřitelné: brána zelená, report přegenerován."
    status: done
---

# Fáze 41 — report z auto session

Zopakován vzor fáze 40 (read-once reference), tentokrát na blok `# Projekt`.

## Co se udělalo

1. **`autoPhase.ts`** — `AutoPhaseContext` dostal opt-in `useProjectRef?: boolean`
   (default vypnuto, s doc komentářem). Projekt vytažen z inline `return` do
   proměnné `projectBlock`: při `useProjectRef: true` se pod `# Projekt` vykreslí
   odkaz na `.mini/project.md` + read-once instrukce (zrcadlí `notesBlock`); jinak
   beze změny inline `projectMd.trim()`.
2. **`autoPhase.test.ts`** — dva nové testy: reference mód (obsahuje
   `.mini/project.md` + „znovu ho nenačítej", NEobsahuje inline text projektu) a
   default inline (obsahuje text projektu, neodkazuje na soubor). Snapshot `.snap`
   se jen rozšířil (63 řádků přidáno, 0 odebráno) — existující snapshoty beze změny.
3. **`context.ts`** — `do` větev nastaví `useProjectRef: true` (bezpodmínečně,
   `project.md` v `do` vždy existuje). Nový test v `context.test.ts`: `do` výstup
   má odkaz `.mini/project.md` + read-once, ne inline tělo projektu.
4. **`measure.ts`** — z `doSpec.blocks()` odebrán blok `projekt`, `build` přepnut
   na `useProjectRef: true`, komentář aktualizován (Read call se nepočítá).
   Snapshoty `measure.test.ts` aktualizovány (`-u`), reálný `.mini/token-report.md`
   přegenerován.

## Ověření (strojově, vše zelené)

- `npm run typecheck`, `npm run build` — bez chyb.
- `npm test` — 446 testů zelených (36 souborů).
- `npm run measure-tokens` — report přegenerován; `do` reálný 1792 → 1702,
  vkládaný kontext 542 → 425, blok `projekt` z rozpadu `do` zmizel.

## Poznámky

- Token-report rámován jen jako „přegenerováno" — v tomhle repu je `project.md`
  drobné, takže pokles je malý; hodnota je konzistence vzoru + úspora u projektů
  s velkým `project.md`. Žádná tvrdá prahová hodnota přidána (dle diskuse).
- Mimo rozsah dle diskuse: `auto` (samostatná session) i headless `mini do`
  (builder `buildDoPhasePrompt`) zůstávají inline.
- Vše ověřeno strojově (typecheck/build/test/measure), nic nevyžaduje lidský
  pohled — `verify` vynecháno.
