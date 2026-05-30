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
