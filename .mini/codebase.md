# mini — přehled kódu

## Přehled
Mini je CLI orchestrátor nad Claude Code, který drží stav projektu (fáze + kroky) v `.mini/state.json` a každému subcommandu (`init`, `next`, `plan`, `do`, `done`, `auto`, `discuss`, `audit`, `map`, `status`, `undo`, `import-gsd`, `model`) generuje cílený prompt a spouští binárku `claude` (subprocess) buď v one-shot JSON režimu (`ask`), interaktivně (`work`) nebo se streamovaným NDJSON výstupem (`stream`). Po dokončené fázi (`mini done`) běží tři side-effecty: git auto-commit (`src/git.ts`), zápis paměti (`.mini/memory/`) a přegenerování strojové mapy projektu (`.mini/graph.md` přes vlastní TS/PHP/Rust mappery v `src/graph/`). Runtime Node ≥20, ESM, TypeScript. Distribuce: lokální `~/.local/bin/mini` symlink přes `scripts/install-local.sh`.

## Adresářová struktura
- `src/` — všechen zdrojový kód (rootDir v `tsconfig.json`)
  - `src/cli.ts` — entrypoint (`bin: mini`), commander dispatch
  - `src/git.ts` — tenký wrapper nad `git` subprocess (auto-commit, soft reset, dotazy)
  - `src/commands/` — jeden soubor na subcommand + sdílené typy
  - `src/claude/` — wrappery nad `claude` CLI subprocess
  - `src/prompts/` — buildery promptů (čisté funkce, žádné I/O)
  - `src/state/` — `.mini/` persistence, parsery, detekce brownfieldu
  - `src/graph/` — strojová mapa projektu: TS/PHP/Rust mappery + render do `.mini/graph.md`
  - `src/ui/` — formátování konzolového výstupu, prompts wrapper
- `scripts/install-local.sh` — build + install do `~/.local/share/mini/versions/<v>/`
- `dist/` — build output (gitignored, generováno `tsc`)
- `.mini/` — runtime data projektu (state, project.md, discuss/, run/, memory/, codebase.md, graph.md, last-memory.md)

## Klíčové moduly

### Entrypoint a CLI
- `src/cli.ts` — commander definice všech subcommandů, dynamický `import()` handlerů (rychlejší startup)

### Commands (každý exportuje async funkci, většina vrací `StepOutcome`)
- `src/commands/types.ts` — `StepOutcome` (ok/reason discriminated union) a `AutoOptions`
- `src/commands/init.ts` — interaktivní založení projektu (project.md + state.json); pokud je brownfield, nabídne hned `audit`
- `src/commands/next.ts` — návrh další fáze (manual / hint / Claude estimate); parsuje `TITLE:`/`GOAL:`
- `src/commands/plan.ts` — rozmen aktuální fáze na 3-7 kroků; parsuje `STEP:` řádky
- `src/commands/do.ts` — pošle Claudovi prompt fáze/kroku; podporuje `--stream`, `--max-turns`, auto režim s `acceptEdits`
- `src/commands/done.ts` — verifikace fáze/kroku; v auto módu čte `.mini/run/phase-{id}.md` přes `applyAutoReport()` a fallbackuje do interaktivu při chybě parsování. Po finalizaci fáze jako `done` volá `finalizePhaseSideEffects()` → git auto-commit (`commitPhaseWork`, zapíše `phase.autoCommit`), `writePhaseMemory()` a `regenerateGraph()`. Body `verify` z reportu řeší `handleVerify()` (pass/skip/issue/block); blocker založí opravnou podfázi s float ID (`insertFixSubphase`, 21 → 21.1)
- `src/commands/auto.ts` — chain `next → plan → (do → done){retry}`; max `MAX_PHASE_ITERATIONS = 3` průchodů na fázi, mezi pokusy přejmenuje report na `.prev.md` jako kontext pro Clauda
- `src/commands/discuss.ts` — diskusní session (allowedTools = R/G/G/LS/Write), Claude na konci zapíše poznámky do `.mini/discuss/phase-{id}.md`
- `src/commands/audit.ts` — spouští Clauda nad existujícím kódem, výstup `.mini/codebase.md` (TENTO soubor); blokovaný na greenfieldu
- `src/commands/map.ts` — `mini map`; přegeneruje `.mini/graph.md` přes `buildGraph()`. Detekuje mapovatelný projekt (`hasMappableProject`), jinak nasměruje na `/graphify`
- `src/commands/import-gsd.ts` — jednorázový import GSD projektu z `.planning/`; parsuje `NAME:`/`WHAT:`/`PHASES:`, mapuje statusy přes `STATUS_MAP`
- `src/commands/status.ts` — barevný přehled fází a kroků (picocolors) + hint na další akci
- `src/commands/undo.ts` — restore `state.prev.json` → `state.json` s diff popisem; když poslední fáze měla `autoCommit` a HEAD pořád sedí + čistý strom (`classifyRevert`), nabídne i `git reset --soft preSha`
- `src/commands/writeMemory.ts` — **není CLI command**, volá ho `done` po fázi. Zapíše `.mini/memory/phase-{id}-{ts}.md` + aktualizuje symlink `.mini/last-memory.md`. Default skládá soubor přímo v TS (`buildPhaseMemoryMarkdown`, bez Claude API); Clauda zavolá jen když je scope `memory` explicitně nastaven. Nice-to-have — nikdy nehází
- `src/commands/model.ts` — `mini model [scope] [name]`; per-scope override (`default`/`next`/`plan`/`do`/`importGsd`/`audit`/`memory`)

### Claude wrappery (`src/claude/`)
- `src/claude/ask.ts` — `claude -p --output-format json`, stdin prompt, parsuje `result`/`usage`/`cost`; default timeout 5 min
- `src/claude/work.ts` — `claude` s `stdio: 'inherit'` (plně interaktivní session); typ `PermissionMode`
- `src/claude/stream.ts` — `claude -p --output-format stream-json --verbose`, vlastní `createLineBuffer()` na NDJSON, `parseStreamEvent()` mapuje system-init/assistant/user/result do typovaných eventů s `RawEnvelope` pro raw přístup

### Prompts (`src/prompts/`) — čisté buildery, jeden soubor na prompt
- `auditCodebase.ts` (`buildAuditCodebasePrompt`, exportuje `CODEBASE_FILE = '.mini/codebase.md'`)
- `nextPhase.ts` — historie fází + volitelný `userHint`, výstupní formát `TITLE:`/`GOAL:`
- `planPhase.ts` — fáze + discuss notes, výstup `STEP:` řádky
- `doPhase.ts` — interaktivní `do`; vyznačuje `focusedStep` značkou „← pracuj na tomhle"
- `autoPhase.ts` — auto `do`; vynucuje YAML front matter report do `.mini/run/phase-{id}.md` (statusy kroků, `verdict`, sekce `verify` s body k ručnímu ověření); podporuje `AutoPhaseRetryContext` pro 2./3. pokus
- `discussPhase.ts` — diskuse + povinný zápis poznámek
- `importGsd.ts` — kostra GSD projektu, výstup `NAME:`/`WHAT:`/`FOR_WHOM:`/`CONSTRAINTS:`/`PHASES:`
- `writeMemory.ts` (`buildWriteMemoryPrompt`, exportuje `MEMORY_DIR = '.mini/memory'`, `LAST_MEMORY_FILE = '.mini/last-memory.md'`) — prompt pro Claude režim zápisu paměti (sekce Co se udělalo / Klíčová rozhodnutí / Otevřené konce); použije se jen při explicitním `memory` scope

### Git (`src/git.ts`)
- Tenký wrapper nad `git` subprocess (`execFile`). `runGit()` nikdy nehází — `ok: false` pokrývá nenulový exit i ENOENT. Helpery: `isGitRepo`/`hasChanges`/`commitAll` (`add -A` + commit)/`currentBranch`/`headSha`/`headSubject`/`isCleanWorkingTree`/`softResetTo` (`reset --soft`)

### Graph (`src/graph/`) — strojová mapa projektu (`.mini/graph.md`)
- `types.ts` — `FileGraph`, `ExportInfo`/`ExportKind`, `ImportInfo`, `FunctionSignature`/`MethodSignature`/`Parameter`
- `buildGraph.ts` (`GRAPH_FILE = '.mini/graph.md'`) — `buildGraph()` projde projekt (`walk`, ignoruje build/VCS adresáře vč. `vendor`/`target`), namapuje `.ts`/`.tsx`/`.php`/`.rs` a atomicky zapíše markdown (`renderGraphMarkdown`). `hasMappableProject()` detekuje tsconfig/Cargo.toml/composer.json nebo aspoň jeden mapovatelný soubor
- `mapper.ts` — TS/TSX mapper přes `ts.createSourceFile` (syntaktický průchod, žádný typový resolver); textové signatury z anotací v kódu
- `phpMapper.ts` — regex PHP mapper (smaže komentáře/stringy, brace-counting na top-level `use`/`class`/`interface`/`trait`/`function` + veřejné metody)
- `rustMapper.ts` — regex Rust mapper (top-level `use`/`pub fn|struct|enum|trait`, ignoruje `impl`/`mod` vnitřek)

### State (`src/state/`)
- `types.ts` — `Step`, `Phase` (vč. volitelného `autoCommit: PhaseAutoCommit` a `humanNotes`), `PhaseAutoCommit` (`preSha`/`sha`/`subject` pro bezpečný soft reset v undo), `ProjectState` (verze 1), `ProjectModels`, `StepStatus`, `PhaseStatus`
- `store.ts` — atomické `save()` (tmp + rename), automatická záloha do `state.prev.json`, helpers `load`/`loadPrev`/`restorePrev`/`exists`/`hasPrev`/`readProject`/`writeProject`
- `models.ts` — `MODEL_SCOPES` (vč. `memory`), `SCOPE_LABELS`, `resolveModel(scope, state)` (per-scope → default → legacy `model` → undefined), `getDefaultModel`
- `brownfield.ts` — `isBrownfield(cwd)`; ignoruje `.git`/`.mini`/`.planning`/`node_modules`/`dist`/`build`/`.next`/`.cache`/`.turbo`/`coverage`/`.DS_Store`
- `discussNotes.ts` — čtení `.mini/discuss/phase-{id}.md` (vrací `null` při ENOENT)
- `runReport.ts` — kontrakt reportu z auto session: typy `RunStepStatus`/`RunVerdict`/`RunReport`/`RunReportVerifyItem` (body k ručnímu ověření, volitelné), vlastní minimální YAML parser (žádný runtime dep), `parseRunReport()` strict-validuje phase ID + step titles, `RunReportParseError` shazuje do interaktivního fallbacku

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
- **TypeScript jako runtime dep:** balík `typescript` je v `dependencies` (ne jen dev) — `src/graph/mapper.ts` ho používá za běhu (`import ts`) k syntaktickému parsování TS/TSX souborů do mapy
- **Build:** `tsc` (out `dist/`)
- **Dev runner:** `tsx` (`npm run dev` = `tsx src/cli.ts`)
- **Test runner:** [vitest](https://vitest.dev/) ^4.1.7 (snapshot testy v `src/prompts/__snapshots__/`)
- **Externí závislost runtime:** binárka `claude` (Claude Code CLI) musí být v `PATH` — commandy `do`/`next`/`plan`/`discuss`/`audit`/`import-gsd`/`auto` (a `done` při explicitním `memory` scope) ji spawnují přes `child_process.spawn`
- **Volitelná externí závislost:** binárka `git` — auto-commit po fázi a soft reset v undo (`src/git.ts`); chybí-li, side-effecty se tiše přeskočí (nikdy neshodí workflow)
- **Instalace:** `npm run install-local` → `~/.local/bin/mini` symlink na `~/.local/share/mini/versions/<v>/dist/cli.js` (verzované, rollback přes ruční smazání)
