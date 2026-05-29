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
