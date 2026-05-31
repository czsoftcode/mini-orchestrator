---
phase: 88
verdict: done
steps:
  - title: "Helper isGlobalInstall()"
    status: done
  - title: "Postinstall: na global install nainstaluj prikazy i bez TTY"
    status: done
  - title: "Postinstall: na global install nastav statusline bez dotazu"
    status: done
  - title: "Testy postinstallu pro global vs lokalni install"
    status: done
  - title: "Dokumentace: npm i -g instaluje do user scope + statusline"
    status: done
verify:
  - title: "Real `npm i -g mini-orchestrator` on a clean machine sets up commands + statusline"
    detail: "Mechanicky pokryto unit testy (HOME + INIT_CWD + npm_config_global do temp diru). Skutecny end-to-end global install pres npm (kde npm_config_global nastavuje samo npm) jsem nespoustel — stoji za rucni overeni po publish: po `npm i -g` zkontrolovat, ze vznikl ~/.claude/commands/mini a ze ~/.claude/settings.json ma statusLine (pokud uz jeden nemel)."
---

# Phase 88 — report from the auto session

## Příčina chyby
`runPostinstall` se při `!isInteractive()` vracel hned po vypsání hintu — neinstaloval nic. Protože npm spouští lifecycle skripty bez TTY na stdin, `npm i -g` tím pádem nikdy nenainstaloval ani `/mini:*` příkazy, ani statusline. Přesně to uživatel reportoval.

## Co bylo uděláno
- **`isGlobalInstall(env = process.env)`** v `src/install/postinstall.ts` — čistá, injektovatelná funkce; `true` jen když `npm_config_global === 'true'` (npm tuto proměnnou nastaví pro lifecycle skripty globální instalace).
- **`runPostinstall`** nově rozlišuje: `auto = !interactive && isGlobalInstall()`.
  - `!interactive && !auto` (lokální / CI bez TTY) → beze změny: jen breadcrumb hint, nic se nezapíše.
  - `auto` → příkazy se nainstalují s **vynuceným user scope** (`{ cwd, scope: 'user' }`), aby případný `claude` v `INIT_CWD` nestočil detekci na project scope.
  - statusline v `auto` režimu řeším elegantně přes existující `offerStatusline({ interactive: true, confirm: async () => true })` — to přeskočí no-TTY return, ale díky dry-run preview uvnitř **nikdy nepřepíše cizí `statusLine`**.
- **Testy** (`postinstall.test.ts`): přidána HOME izolace (temp dir, protože `os.homedir()` na POSIX následuje `$HOME`), test `isGlobalInstall`, test global installu (příkazy v `~/.claude/commands/mini`, ne v cwd; statusLine v settings.json), test že cizí statusLine zůstane nedotčená, a doplněna kontrola že lokální install nesahá ani na home.
- **README**: poznámka v sekci Installation + upřesnění v sekci statusline (interaktivní install se ptá, global install nastaví bez dotazu).

## Ověření
- `npm run typecheck` čistý.
- Celá suite zelená: 711 testů (předtím 708, +3 nové).

## Pozn. pro člověka
Build (`dist/`) jsem nepřegeneroval — postinstall za běhu jede z `dist/install/postinstall.js`, takže pro reálné ověření po publishi je potřeba `npm run build`. Při `done --push` to řeší prepublishOnly. Skutečný global install přes npm viz `verify` výše.
