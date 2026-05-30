---
phase: 23
verdict: done
steps:
  - title: "W1: osiřelou doing fázi po podfázi dozavřít"
    status: done
  - title: "W2: Math.floor v commitPhase brání desetinnému ID"
    status: done
  - title: "W3: verify v auto módu bez TTY bezpečně"
    status: done
  - title: "W4: opakovaný done nepřehrává vyřešené verify body"
    status: done
  - title: "Doplnit testy pro W1–W4"
    status: done
  - title: "Zelené testy a čistý tsc --noEmit"
    status: done
---

# Fáze 23 — report z auto session

Implementoval jsem všechny čtyři body z `.mini/improvements.md`, sekce 1.

## Co se udělalo

**W1 — osiřelá `doing` fáze (`done.ts`)**
Přidal jsem `closeOrphanedDoingParents(state)`, kterou volá `advanceToNextPhase`.
Když je rodičovská fáze ve stavu `doing`, má aspoň jednu opravnou podfázi (float
ID) a všechny její podfáze jsou uzavřené (`done`/`skipped`), rodič se dozavře
jako `done` (jeho kroky byly hotové už před vznikem podfáze, jinak by se verify
nespustil). Protože všechny finalizační cesty v `done.ts` volají
`advanceToNextPhase`, reconciliace proběhne po dokončení každé fáze. Běžné
`doing` fáze bez podfází zůstávají nedotčené.

**W2 — desetinné ID po podfázi (`next.ts`)**
`commitPhase` teď počítá `Math.floor(Math.max(0, ...ids)) + 1`. Existence
podfáze `21.1` už nezpůsobí top-level ID `22.1`.

**W3 — verify bez TTY (`done.ts` + nový `ui/interactive.ts`)**
Nový `isInteractive()` (kontroluje `process.stdin.isTTY && process.stdout.isTTY`).
V `handleVerify` se bez interaktivního terminálu `ask()` vůbec nevolá — fáze se
nezavře a vrací se `{ ok: false, reason: 'verify-needs-human' }` s jasnou
hláškou. Verify tak nikdy tiše neprojde jako `pass` (dřív `prompts` bez TTY
vracel `undefined` → vyhodnoceno jako pass). Vyčlenění do vlastního modulu
umožňuje mockování v testech.

**W4 — opakované přehrávání verify (`done.ts` + `types.ts`)**
Nové pole `Phase.resolvedVerify: string[]` drží názvy bodů, které člověk už
odbavil jako `pass`/`skip`. `handleVerify` je při dalším průchodu nad stejným
reportem přeskočí; když po filtru nezbude žádný bod, fáze se rovnou zavře.

## Testy

286 → 292 testů (6 nových), všechny zelené, `tsc --noEmit` čistý.
- W1: tři unit testy nad `advanceToNextPhase` (dozavření rodiče, nedozavření
  při neuzavřené podfázi, nedotčená běžná `doing` fáze).
- W2: `next({ auto: true })` nad stavem s podfází 21.1 → nová fáze dostane ID 22.
- W3: `done({ auto: true })` bez TTY → `verify-needs-human`, `ask()` se nevolá.
- W4: dvojí `done({ auto: true })` nad stejným reportem → pass bod se podruhé
  nenabídne.
Existující verify testy běží proti mocku `isInteractive` (default `true`).

## Poznámka / otevřená věc (mimo W1–W4)

Při zkoumání jsem narazil na navazující mezeru: po `verify-needs-human` /
`verify-issue` zůstane fáze `doing` se všemi kroky `done`. Opětovné `mini auto`
ale skončí už v `doPhase` na kontrole „všechny kroky hotové“ (`all-steps-done`)
a k verify se znovu nedostane; `mini done` (bez `--auto`) zase report vůbec
nečte. Re-verifikace tedy reálně proběhne jen při opětovném volání
`done({ auto: true })`. Sám W4 fix je správný a obrana funguje, jen samotná
cesta „jak se k re-verify znovu dostat“ je širší workflow téma — sedělo by spíš
do nové položky backlogu (navazuje na D1), ne do W1–W4. Nechávám na zvážení.
