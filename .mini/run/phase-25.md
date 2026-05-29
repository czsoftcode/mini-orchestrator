---
phase: 25
verdict: done
steps:
  - title: "Propojit `--max-turns` z cli do `doPhase` (R1)"
    status: done
  - title: "Test ověří, že `--max-turns` dorazí do Claude (R1)"
    status: done
  - title: "Sjednotit ENOENT hlášku „claude\" s návodem na instalaci (R3)"
    status: done
  - title: "Přidat `mini next` jeden retry při parse-failed (R4)"
    status: done
  - title: "Test ověří retry i tolerantní formát v `next` (R4)"
    status: done
  - title: "E2e test auto smyčky proti fake claude binárce (R2)"
    status: done
  - title: "`tsc --noEmit` čistý a všechny testy zelené"
    status: done
---

# Fáze 25 — report z auto session

Vyřízeny všechny čtyři položky R1–R4 z `.mini/improvements.md`. `tsc --noEmit` je
čistý a všech **308 testů** je zelených (baseline byla 286, přibylo 22 nových).

## Co se udělalo

**R1 — `--max-turns` se tiše ignoroval**
- `cli.ts`: action příkazu `do` teď předává `doPhase({ stream, maxTurns })` —
  dřív `maxTurns` zahodil, takže volba byla no-op.
- Nový `src/commands/do.test.ts` ověřuje, že `doPhase({ maxTurns })` propíše limit
  do `workWithClaude` i (s `--stream`) do `streamWithClaude`, a že bez volby je
  `maxTurns` `undefined`.
- Tím je zároveň vyřešená premisa **D3** (help u `do --max-turns` teď odpovídá
  skutečnému chování).

**R3 — sjednocená hláška při chybějícím `claude`**
- Nový modul `src/claude/spawnError.ts` (`describeSpawnError` + `CLAUDE_NOT_FOUND_MESSAGE`):
  ENOENT přeloží na srozumitelný návod na instalaci (odkaz na claude.com/claude-code),
  ostatní chyby zabalí jednotně. Volají ho všechna tři spawn místa — `work.ts`,
  `stream.ts`, `ask.ts` — takže UX je všude stejné (i memory přes `askClaude`).
- `spawnError.test.ts` ověřuje překlad ENOENT i jednotný obal ostatních chyb.

**R4 — retry + tolerantní parser v `mini next`**
- `parseSuggestion` je teď tolerantní k drobným odchylkám formátu: úvodní
  markdown dekorace (`#`, `*`, `-`, `>`), velikost písmen markeru, obalující
  `**bold**` a chybějící mezera za dvojtečkou. Markery ale pořád musí stát na
  začátku řádku (prozaický text uprostřed se nechytá — pokrývají to původní testy).
- `next()` dá při neparsovatelné odpovědi **jeden** cílený retry s dovětkem
  upřesňujícím formát, než vrátí `parse-failed`. Bez něj jedna odchylka shazovala
  celou auto smyčku hned v prvním kroku.
- Do `next.test.ts` přibyly testy tolerance parseru i retry chování (úspěšný
  druhý pokus, obsah retry promptu, vyčerpání limitu → `parse-failed`).

**R2 — e2e test reálné auto smyčky**
- Nový `src/commands/auto.e2e.test.ts` **nemockuje** Claude moduly. Napíše na disk
  fake `claude` binárku (Node skript), přidá ji na začátek PATH a spustí reálnou
  `auto()`. Fake binárka odpovídá na ask volání (`-p`) podle promptu (TITLE/GOAL
  pro `next`, STEP řádky pro `plan`) a u work session přečte `.mini/state.json`
  a zapíše report označující kroky jako `done`. Test ověří skutečný průchod
  `next → plan → do → done` přes spawn, stdin/stdout, zápis i parse reportu a
  posun stavu — tedy švy mezi moduly, které unit mocky v `auto.test.ts` nepokrývaly.

## Ověření

Vše ověřeno strojově — `npx tsc --noEmit` (čistý) a `npx vitest run`
(27 souborů, 308 testů zelených), včetně cíleného běhu e2e a `do` testů.
Nic nezbývá na ruční ověření člověkem.

## Poznámky

- Položky R1–R4 jsem v `.mini/improvements.md` škrtl a přesunul do sekce „Hotovo"
  (stejná konvence jako fáze 23/24), aby při re-runu fáze 22 nevznikaly duplicity.
- D3 zůstává v backlogu formálně jako samostatná položka, ale jeho premisa
  (mrtvý slib v helpu) je opravou R1 fakticky vyřešená — poznamenáno u R1 v Hotovo.
