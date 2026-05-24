---
phase: 10
verdict: done
steps:
  - title: "Vytvořit utilitu brownfield detekce (sdílená init+audit)"
    status: done
  - title: "Přidat scope 'audit' do ProjectModels a models.ts"
    status: done
  - title: "Napsat prompt builder auditCodebase.ts + snapshot test"
    status: done
  - title: "Implementovat příkaz mini audit (greenfield warning, Claude session, tokens summary)"
    status: done
  - title: "Zaregistrovat audit v cli.ts"
    status: done
  - title: "Upravit init — v brownfieldu nabídnout spustit audit"
    status: done
  - title: "Doplnit README (tabulka příkazů, .mini/codebase.md, zmínka v init)"
    status: done
---

# Fáze 10 — report z auto session

## Co se povedlo

- **Brownfield utilita** `src/state/brownfield.ts` — exportuje `BROWNFIELD_IGNORED` (set ignored adresářů: `.git`, `.mini`, `.planning`, `node_modules`, `dist`, `build`, `.next`, `.cache`, `.turbo`, `coverage`, `.DS_Store`) a `isBrownfield(cwd)`. Sdílí ji `init.ts` i `audit.ts`.
- **Scope `audit`** přidán do `ProjectModels` (`src/state/types.ts`), do `MODEL_SCOPES` a `SCOPE_LABELS` (`src/state/models.ts`). `resolveModel('audit', state)` funguje stejně jako u ostatních scopů.
- **Prompt builder** `src/prompts/auditCodebase.ts` (+ `CODEBASE_FILE = '.mini/codebase.md'`). Prompt je explicitní: pokud soubor existuje, první akcí je `Read`, dále se nepřepisuje celý soubor, ale `Edit` jednotlivých sekcí; ruční poznámky se zachovávají. Fixní struktura sekcí: `Přehled / Adresářová struktura / Klíčové moduly / Technologie`. Snapshot test `auditCodebase.test.ts` prošel (4 testy).
- **Příkaz `mini audit`** v `src/commands/audit.ts`:
  - greenfield → `log.warn('Není co auditovat — adresář je prázdný.')` + hint, žádný soubor se nezapisuje,
  - brownfield → `askClaude(prompt, { allowedTools: ['Read','Grep','Glob','LS','Write','Edit'], permissionMode: 'acceptEdits', timeoutMs: 10 min, model: resolveModel('audit', state) })`,
  - po session vypíše `logUsage()` (tokens + cena) a `log.success` zprávu.
- **`askClaude` rozšířen o `permissionMode`** (`src/claude/ask.ts`) — bez něj by Write/Edit v print-mode session bylo zablokované. Reusuje `PermissionMode` typ z `work.ts`.
- **Registrace v CLI** (`src/cli.ts`) — `mini audit` jako další command sesterské `import-gsd`.
- **Init flow** (`src/commands/init.ts`) po úspěšném založení projektu zkontroluje `isBrownfield(cwd)` a (pokud true) interaktivně nabídne `Spustit teď mini audit?` s defaultem `true`. Při souhlasu rovnou zavolá `audit()` (dynamický import, ať init zůstane lehký). Při ne — `log.hint('Můžeš spustit kdykoli: mini audit')`.
- **README** doplněn: tabulka příkazů obsahuje `mini audit` a v popisu `mini init` je zmínka o brownfield nabídce; sekce „Soubory v projektu" má `.mini/codebase.md` se stručným vysvětlením, že soubor se neinjektuje automaticky a `mini audit` zachovává ruční poznámky; v sekci „Modely" je `audit` přidán do seznamu scopů.

## Kontroly

- `npm run typecheck` — projde bez chyb.
- `npx vitest run src` — 161 testů projde (včetně 4 nových v `auditCodebase.test.ts`, snapshot zapsán).
- `npm test` (bez explicitní cesty) zachytí i `dist/`, kde leží **staré** zkompilované testy proti starým snapshotům — 4 failed na `dist/prompts/discussPhase.test.js`. **Není to regrese této fáze** — failující testy se vážou k předchozím změnám v `discussPhase.ts`, které nejsou propsané do `dist/`. Mimo scope fáze 10, doporučuji řešit jednorázovým `npm run build` nebo přidáním `exclude: ['dist/**']` do vitest configu (až do budoucí fáze).

## Pozor / otevřené otázky

- **`permissionMode` v print mode auditu**: `--permission-mode acceptEdits` + `-p --output-format json` by mělo Claude CLI akceptovat, ale chování není 100 % ověřeno v běhu (snapshot test pokrývá jen text promptu, ne reálnou session). Při prvním reálném `mini audit` to bude třeba ověřit — kdyby Write byl odmítnut, lze fallback na `workWithClaude` (interaktivní stream) nebo `bypassPermissions`.
- **Cena auditu** může být na velkých projektech znatelná (Claude přečte `package.json` + projde `src/`). Timeout je nastaven na 10 min. Tokens summary uvidí uživatel hned po session.
- **`mini status`** o existenci/aktuálnosti `.mini/codebase.md` ne informuje — to bylo v poznámkách k fázi explicitně vyloučeno (out of scope, případně později).
- `mini auto` audit nevolá — audit je čistě ad-hoc, manuálně volaný příkaz.
