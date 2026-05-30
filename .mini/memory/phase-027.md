# Fáze 27 — mini příkazi přímo v claude

**Cíl:** Až bude možné příkazy mini spouštět přímo v claude pomocí /

## Kroky
- [hotovo] Pod-příkaz `mini context <cmd>` vypíše prompt na stdout
- [hotovo] Neinteraktivní stavové pod-příkazy s flagem `--apply`
- [hotovo] Příkaz `mini install-commands` generuje commandy idempotentně
- [hotovo] Vygenerovat `.claude/commands/mini/*.md` pro pět commandů
- [hotovo] Testy pro context, apply a install-commands
- [hotovo] Ověřit cyklus next→discuss→plan→do→done v session

## Auto-commit
- Fáze 27: mini příkazi přímo v claude (`e570dddc2e62b573694aaa3c7630b19b5da37f62`)

## Diskuse
# Fáze 27 — mini příkazi přímo v claude

## Záměr
Umožnit spouštět workflow mini přímo z Claude Code přes custom slash commandy
(`/`), aniž by se uvnitř session spouštěl vnořený Claude. Cílem je, aby celý cyklus
`next → discuss → plan → do → done` šel projet v jedné Claude session.

CLI `mini ...` přes Bash zůstává beze změny — slash commandy jsou doplněk, ne náhrada.

Rozsah fáze 27: commandy `/mini:next`, `/mini:discuss`, `/mini:plan`, `/mini:do`,
`/mini:done`. `/mini:auto` (řetěz plan → (do)* → done) se nechává na pozdější fázi.

## Klíčová rozhodnutí
- **Namespace `/mini:`** — soubory v `.claude/commands/mini/` (`next.md`, `discuss.md`,
  `plan.md`, `do.md`, `done.md`). Dvojtečka odděluje namespace od názvu; drží mini
  commandy pohromadě a brání kolizím.
- **Tenké tělo .md** — markdown command sám nedrží zmrazený prompt; volá pomocný
  mini pod-příkaz (typ `mini context <cmd>`), který vypíše vždy aktuální prompt/kontext.
  Prompty tak zůstávají na jednom místě v mini a nezastarají.
- **Stav drží mini (varianta b)** — agentní práci dělá Claude v aktuální session, ale
  stavové operace (`.mini/state.json`, run reporty, posun fáze, uložení kroků, uložení
  nové fáze) provádějí **neinteraktivní** mini pod-příkazy volané přes Bash. Stav tak
  zůstává v otestovaném TS, ne ve volném promptu.
- **Instalace přes `mini install-commands`** — nový příkaz vygeneruje
  `.claude/commands/mini/*.md` do cílového projektu; má jít pustit opakovaně (aktualizace).
- **Bez vnořeného Claude** — nativní commandy neběží jako `Claude → mini → Claude`.

## Pozor na
- **Existující `plan`/`do`/`done`/`next` jsou interaktivní a samy spouští Claude** —
  pro volání z Bash uvnitř session se nehodí. Bude třeba doplnit neinteraktivní
  pod-příkazy (nové subcommandy nebo flag typu `--apply`), které jen čtou/zapisují stav:
  načtení kontextu fáze (project.md + aktuální fáze + discuss poznámky), uložení kroků
  z plánu, označení kroku + zápis run reportu, posun fáze, uložení nové fáze z `next`.
  Část logiky lze využít: `advanceToNextPhase`, `buildPhaseCommitMessage`,
  `state/runReport.ts`, `buildDiscussPhasePrompt`/`buildPlanPhasePrompt`/atd.
- **Commandy patří do cílového projektu, ne do repa mini** — `.claude/commands/mini/`
  toho projektu, kde uživatel pracuje s Claude Code. Proto je nutná instalace.
- **Lidská verifikace v `done`** — v session se vyřeší přirozeně dotazem v chatu;
  posun stavu pak udělá pod-příkaz.
- **`next` je vstupní bod** cyklu (ještě neexistuje aktuální fáze) — to návrhu nevadí.
- Nový přístup; lze stavět po částech (auto a případné další commandy v dalších fázích).

## Run report
---
phase: 27
verdict: done
steps:
  - title: "Pod-příkaz `mini context <cmd>` vypíše prompt na stdout"
    status: done
  - title: "Neinteraktivní stavové pod-příkazy s flagem `--apply`"
    status: done
  - title: "Příkaz `mini install-commands` generuje commandy idempotentně"
    status: done
  - title: "Vygenerovat `.claude/commands/mini/*.md` pro pět commandů"
    status: done
  - title: "Testy pro context, apply a install-commands"
    status: done
  - title: "Ověřit cyklus next→discuss→plan→do→done v session"
    status: done
verify:
  - title: "Skutečný běh /mini:* uvnitř živé Claude Code session"
    detail: "Ověřil jsem celý cyklus end-to-end přes zkompilované CLI (context → --apply pro next/plan/do/done, včetně verify větve s/bez --accept-verify) i unit/integration testy. Skutečné spuštění slash commandů v běžící Claude Code session (kde agentní práci dělá Claude) jsem z principu nemohl vyzkoušet — vyžaduje, abys v projektu pustil `mini install-commands` a zkusil `/mini:next` … `/mini:done`."
---

# Fáze 27 — report z auto session

Cíl fáze splněn: workflow mini jde teď projet přímo z Claude Code přes nativní slash commandy, bez vnořeného Claude. Implementoval jsem všechny zbývající kroky.

## Co vzniklo

- **`mini context <cmd>`** (`src/commands/context.ts`) — vypíše na stdout aktuální session prompt pro `next|discuss|plan|do|done`. Na stdout jde jen prompt (přes `process.stdout.write`), chyby přes `log` + nenulový exit code. Pro `do` reuse `buildAutoPhasePrompt` (Claude na konci zapíše report), pro `discuss` `buildDiscussPhasePrompt`, pro `next/plan/done` nové session-prompty.
- **Session-prompty** (`src/prompts/sessionContext.ts`) — `buildNextSessionPrompt`, `buildPlanSessionPrompt`, `buildDoneSessionPrompt`. Na rozdíl od headless promptů neříkají Claudovi „odpověz fixním formátem", ale „odveď práci a stav ulož přes `mini … --apply`".
- **Neinteraktivní `--apply` pod-příkazy**:
  - `mini next --apply --title … --goal …` → `applyNewPhase` (next.ts, sdílí `commitPhase`)
  - `mini plan --apply` čte kroky ze stdin → `applyPlanSteps` + `parseStepsFromStdin` (tolerantní k `STEP:`, `-`, `*`, `1.` prefixům)
  - `mini do --apply` → `applyDoStart` (označí fázi `doing`, `startedAt`, založí `.mini/run/`)
  - `mini done --apply [--accept-verify]` → `applyDone` (sdílí `applyAutoReport` s auto módem; oproti `done({auto})` **nepadá do interaktivního fallbacku** — chybějící/poškozený report → čistá chyba)
- **`mini install-commands`** (`src/commands/install-commands.ts`) — idempotentně generuje `.claude/commands/mini/*.md`, hlásí nové/změněné/beze změny.
- **Tenké `.md` commandy** — tělo jen pustí `mini context <cmd>` a předá řízení promptu.

## Klíčové rozhodnutí k verify v `done`

Lidská verifikace probíhá v chatu (Claude se zeptá uživatele). Souhlas se do stavu propíše přes `mini done --apply --accept-verify`: `handleVerify` při `acceptVerify` bere pending body jako `pass`, zapíše je do `resolvedVerify` a fázi zavře. Bez flagu (a bez TTY) se fáze nezavře — vrátí `verify-needs-human`. Tím se verify nikdy neztratí ani neproklikne naslepo.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **380 testů, 33 souborů** (46 nových: sessionContext, apply, install-commands, context)
- E2E přes zkompilované CLI v dočasném projektu: `install-commands` → `context next` → `next --apply` → `context plan` → `plan --apply` (stdin) → `do --apply` → zápis reportu → `context done` → `done --apply` (bez accept-verify nezavřel, s accept-verify zavřel, posunul, zapsal memory). Vše dle očekávání.

## Otevřené konce

- `/mini:auto` (řetěz plan → (do)* → done v jedné session) zůstává záměrně mimo rozsah — na pozdější fázi.
- `mini context done` čte report tolerantně; poškozený report neblokuje výpis instrukcí (tvrdou validaci řeší až `--apply`).
- README doplněno o sekci „mini příkazy přímo v Claude Code".
