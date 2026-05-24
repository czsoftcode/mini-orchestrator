# mini — přehled kódu

## Přehled
Mini je CLI orchestrátor nad Claude Code, který drží stav projektu (fáze + kroky) v `.mini/state.json` a každému subcommandu (`init`, `next`, `plan`, `do`, `done`, `auto`, `discuss`, `audit`, `status`, `undo`, `import-gsd`, `model`) generuje cílený prompt a spouští binárku `claude` (subprocess) buď v one-shot JSON režimu (`ask`), interaktivně (`work`) nebo se streamovaným NDJSON výstupem (`stream`). Runtime Node ≥20, ESM, TypeScript. Distribuce: lokální `~/.local/bin/mini` symlink přes `scripts/install-local.sh`.

## Adresářová struktura
- `src/` — všechen zdrojový kód (rootDir v `tsconfig.json`)
  - `src/cli.ts` — entrypoint (`bin: mini`), commander dispatch
  - `src/commands/` — jeden soubor na subcommand + sdílené typy
  - `src/claude/` — wrappery nad `claude` CLI subprocess
  - `src/prompts/` — buildery promptů (čisté funkce, žádné I/O)
  - `src/state/` — `.mini/` persistence, parsery, detekce brownfieldu
  - `src/ui/` — formátování konzolového výstupu, prompts wrapper
- `scripts/install-local.sh` — build + install do `~/.local/share/mini/versions/<v>/`
- `dist/` — build output (gitignored, generováno `tsc`)
- `.mini/` — runtime data projektu (state, project.md, discuss/, run/)

## Klíčové moduly

### Entrypoint a CLI
- `src/cli.ts` — commander definice všech subcommandů, dynamický `import()` handlerů (rychlejší startup)

### Commands (každý exportuje async funkci, většina vrací `StepOutcome`)
- `src/commands/types.ts` — `StepOutcome` (ok/reason discriminated union) a `AutoOptions`
- `src/commands/init.ts` — interaktivní založení projektu (project.md + state.json); pokud je brownfield, nabídne hned `audit`
- `src/commands/next.ts` — návrh další fáze (manual / hint / Claude estimate); parsuje `TITLE:`/`GOAL:`
- `src/commands/plan.ts` — rozmen aktuální fáze na 3-7 kroků; parsuje `STEP:` řádky
- `src/commands/do.ts` — pošle Claudovi prompt fáze/kroku; podporuje `--stream`, `--max-turns`, auto režim s `acceptEdits`
- `src/commands/done.ts` — verifikace fáze/kroku; v auto módu čte `.mini/run/phase-{id}.md` přes `applyAutoReport()` a fallbackuje do interaktivu při chybě parsování
- `src/commands/auto.ts` — chain `next → plan → (do → done){retry}`; max `MAX_PHASE_ITERATIONS = 3` průchodů na fázi, mezi pokusy přejmenuje report na `.prev.md` jako kontext pro Clauda
- `src/commands/discuss.ts` — diskusní session (allowedTools = R/G/G/LS/Write), Claude na konci zapíše poznámky do `.mini/discuss/phase-{id}.md`
- `src/commands/audit.ts` — spouští Clauda nad existujícím kódem, výstup `.mini/codebase.md` (TENTO soubor); blokovaný na greenfieldu
- `src/commands/import-gsd.ts` — jednorázový import GSD projektu z `.planning/`; parsuje `NAME:`/`WHAT:`/`PHASES:`, mapuje statusy přes `STATUS_MAP`
- `src/commands/status.ts` — barevný přehled fází a kroků (picocolors) + hint na další akci
- `src/commands/undo.ts` — restore `state.prev.json` → `state.json` s diff popisem
- `src/commands/model.ts` — `mini model [scope] [name]`; per-scope override (`default`/`next`/`plan`/`do`/`importGsd`/`audit`)

### Claude wrappery (`src/claude/`)
- `src/claude/ask.ts` — `claude -p --output-format json`, stdin prompt, parsuje `result`/`usage`/`cost`; default timeout 5 min
- `src/claude/work.ts` — `claude` s `stdio: 'inherit'` (plně interaktivní session); typ `PermissionMode`
- `src/claude/stream.ts` — `claude -p --output-format stream-json --verbose`, vlastní `createLineBuffer()` na NDJSON, `parseStreamEvent()` mapuje system-init/assistant/user/result do typovaných eventů s `RawEnvelope` pro raw přístup

### Prompts (`src/prompts/`) — čisté buildery, jeden soubor na prompt
- `auditCodebase.ts` (`buildAuditCodebasePrompt`, exportuje `CODEBASE_FILE = '.mini/codebase.md'`)
- `nextPhase.ts` — historie fází + volitelný `userHint`, výstupní formát `TITLE:`/`GOAL:`
- `planPhase.ts` — fáze + discuss notes, výstup `STEP:` řádky
- `doPhase.ts` — interaktivní `do`; vyznačuje `focusedStep` značkou „← pracuj na tomhle"
- `autoPhase.ts` — auto `do`; vynucuje YAML front matter report do `.mini/run/phase-{id}.md`; podporuje `AutoPhaseRetryContext` pro 2./3. pokus
- `discussPhase.ts` — diskuse + povinný zápis poznámek
- `importGsd.ts` — kostra GSD projektu, výstup `NAME:`/`WHAT:`/`FOR_WHOM:`/`CONSTRAINTS:`/`PHASES:`

### State (`src/state/`)
- `types.ts` — `Step`, `Phase`, `ProjectState` (verze 1), `ProjectModels`, `StepStatus`, `PhaseStatus`
- `store.ts` — atomické `save()` (tmp + rename), automatická záloha do `state.prev.json`, helpers `load`/`loadPrev`/`restorePrev`/`exists`/`hasPrev`/`readProject`/`writeProject`
- `models.ts` — `MODEL_SCOPES`, `SCOPE_LABELS`, `resolveModel(scope, state)` (per-scope → default → legacy `model` → undefined)
- `brownfield.ts` — `isBrownfield(cwd)`; ignoruje `.git`/`.mini`/`.planning`/`node_modules`/`dist`/`build`/`.next`/`.cache`/`.turbo`/`coverage`/`.DS_Store`
- `discussNotes.ts` — čtení `.mini/discuss/phase-{id}.md` (vrací `null` při ENOENT)
- `runReport.ts` — kontrakt reportu z auto session: typy `RunStepStatus`/`RunVerdict`/`RunReport`, vlastní minimální YAML parser (žádný runtime dep), `parseRunReport()` strict-validuje phase ID + step titles, `RunReportParseError` shazuje do interaktivního fallbacku

### UI (`src/ui/`)
- `log.ts` — `log.info/success/warn/error/dim/title/hint` s picocolors prefixy `[ok]`/`[!]`/`[x]`
- `ask.ts` — wrapper nad `prompts` s `onCancel → exit(130)`; helpers `nonEmpty()`, `trim()`
- `streamRender.ts` — `createStreamRenderer()` factory pro průběžné tisknutí stream eventů (model, tool uses s prvním smysluplným argumentem, chybové výsledky)
- `usage.ts` — `logUsage()` (po `ask`) a `logStreamSummary()` (po stream session) — tokeny, cache hits, USD náklad

## Technologie
- **Jazyk:** TypeScript 5.6, strict + `noUncheckedIndexedAccess` + `noImplicitOverride`, target ES2022, module NodeNext (čisté ESM s `.js` importy)
- **Runtime:** Node ≥20 (`engines`), `"type": "module"`
- **CLI framework:** [commander](https://www.npmjs.com/package/commander) ^12.1.0 (s `InvalidArgumentError` pro vlastní parser `--max-turns`)
- **Interaktivní prompty:** [prompts](https://www.npmjs.com/package/prompts) ^2.4.2
- **Barvy:** [picocolors](https://www.npmjs.com/package/picocolors) ^1.1.1
- **Build:** `tsc` (out `dist/`)
- **Dev runner:** `tsx` (`npm run dev` = `tsx src/cli.ts`)
- **Test runner:** [vitest](https://vitest.dev/) ^4.1.7 (snapshot testy v `src/prompts/__snapshots__/`)
- **Externí závislost runtime:** binárka `claude` (Claude Code CLI) musí být v `PATH` — všechny commandy `do`/`next`/`plan`/`discuss`/`audit`/`import-gsd`/`auto` ji spawnují přes `child_process.spawn`
- **Instalace:** `npm run install-local` → `~/.local/bin/mini` symlink na `~/.local/share/mini/versions/<v>/dist/cli.js` (verzované, rollback přes ruční smazání)
