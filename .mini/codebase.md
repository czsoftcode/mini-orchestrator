# mini — přehled kódu

## Přehled
Mini je CLI orchestrátor nad Claude Code (npm balík `mini-orchestrator`, příkaz `mini`). Drží stav projektu (fáze + kroky) v layoutu verze 2: lehká hlavička `.mini/state.json` (index fází + metadata) + detail každé fáze zvlášť v `.mini/phases/phase-XXX.json`. Pracuje ve dvou režimech:
1. **Nativní slash commandy** (primární cesta): `mini install-commands` / `mini update` vygenerují `.claude/commands/mini/*.md`; jejich tenké tělo uvnitř běžící Claude Code session spustí `mini context <cmd>`, který vypíše aktuální session prompt na stdout. Claude se jím řídí, agentně pracuje a stav ukládá zpět neinteraktivními `mini <cmd> --apply` příkazy. V tomhle režimu mini binárku `claude` nespouští — běží uvnitř ní.
2. **Klasický subprocess režim**: `mini` spustí binárku `claude` jako subprocess — one-shot JSON (`ask`), interaktivně (`work`) nebo streamovaný NDJSON (`stream`). Používají ho `discuss`, `audit`, `import-gsd` a interaktivní fallbacky.
Po uzavřené fázi (`done` / `--apply`) běží side-effecty v pevném pořadí: zápis paměti (`.mini/memory/`), regenerace strojové mapy (`.mini/graph/` + index `.mini/graph.json`), volitelný bump verze v `package.json` + stamp `CHANGELOG.md`, a jako poslední jediný git auto-commit celé fáze (volitelně `--push` + git tag `v<verze>`). Autonomní `/mini:auto` umí kooperativní stop přes soubor `.mini/STOP`. Runtime Node ≥20, ESM, TypeScript.

## Adresářová struktura
- `src/` — všechen zdrojový kód (rootDir v `tsconfig.json`); ke každému modulu je vedle `*.test.ts` (vitest)
  - `src/cli.ts` — entrypoint (`bin: mini`), commander dispatch
  - `src/version.ts` — verze nástroje + semver bump `package.json`
  - `src/projectVersion.ts` — čtení verze **orchestrovaného** projektu (cizí projekt v cwd) podle jazyka manifestu (package.json / Cargo.toml / pyproject.toml / composer.json / build.gradle / pom.xml)
  - `src/changelog.ts` — práce s `CHANGELOG.md` (keepachangelog, stamp Unreleased)
  - `src/assets.ts` — lokace statického skeletonu `.mini/` (init/update)
  - `src/git.ts` — tenký wrapper nad `git` subprocess (commit, push, tag, soft reset, dotazy)
  - `src/commands/` — jeden soubor na subcommand + sdílené typy
  - `src/claude/` — wrappery nad `claude` CLI subprocess
  - `src/prompts/` — buildery promptů (čisté funkce, žádné I/O); headless i session prompty
  - `src/state/` — `.mini/` persistence (layout v2), parsery, detekce brownfieldu, přečíslování
  - `src/graph/` — strojová mapa projektu: mappery 10 jazyků + render do `.mini/graph/` + index
  - `src/ui/` — formátování konzolového výstupu, prompts wrapper, detekce TTY
  - `src/tokens/` — měření token ceny promptů jednotlivých příkazů
  - `src/statusline/` — čistá logika status line pro Claude Code (bez I/O); buildery dat + render
  - `src/install/` — instalátor `/mini:*` slash commandů + npm `postinstall` hook + nabídka status line
- `assets/skeleton/.mini/` — statická kostra `.mini/` (prázdné adresáře přes `.gitkeep` + `gitignore` bez tečky); zdroj pravdy pro `init`/`update`. `scripts/copy-assets.mjs` ji při buildu kopíruje do `dist/skeleton/`
- `scripts/` — `copy-assets.mjs` (build krok), `postinstall.mjs` (guarded launcher npm `postinstall` hooku — čistý Node, deleguje na `dist/install/postinstall.js`, nikdy nepoloží instalaci), `install-local.sh` (lokální instalace), `measure-prompt-tokens.ts`
- `dist/` — build output (gitignored; `tsc` + skeleton)
- `.mini/` — runtime data projektu: `state.json` (hlavička v2), `state.prev.json`, `phases/` + `phases-prev/`, `project.md`, `discuss/`, `run/`, `memory/`, `graph/` + `graph.json`, `codebase.md`, `last-memory.md`, `STOP` (stop signál), `token-report.md`

## Klíčové moduly

### Entrypoint a CLI
- `src/cli.ts` — commander definice všech subcommandů, dynamický `import()` handlerů (rychlejší startup). Subcommandy: `init`, `next`, `plan`, `do`, `done`, `auto`, `discuss`, `undo`, `status`, `stop`, `import-gsd`, `migrate`, `audit`, `map`, `context`, `update`, `statusline`, `install-commands` (skrytý), `model`. Většina mutujících má `--apply` (neinteraktivní headless mód pro slash commandy); helpery `parseMaxTurns`/`parseBumpLevel`/`ensurePushHasBump`/`readHookFilePath`/`collectFile`/`requireOption`
- `src/version.ts` — `readPackageVersion()` (verze nástroje z vlastního `package.json`), `bumpSemver`/`bumpPackageVersion` (textová náhrada jen hodnoty `"version"`), typy `BumpLevel`/`BumpChoice`
- `src/changelog.ts` — `CHANGELOG_FILE`, `todayIso()`, `stampUnreleased()` (zaklapne `## [Unreleased]` do datované sekce při minor/major vydání; patche se kumulují)
- `src/assets.ts` — najde statický skeleton `.mini/` (dist nebo repo), `readSkeletonEntries()`; `FILE_RENAMES` (`gitignore` → `.gitignore`, npm-safe), `GITKEEP`

### Commands (každý exportuje async funkci, většina vrací `StepOutcome`; mutující mají i `apply*` variantu)
- `src/commands/types.ts` — `StepOutcome` (ok/reason discriminated union), `AutoOptions`, `FinalizeOptions` (`bump`/`push`)
- `src/commands/context.ts` — `mini context <cmd>` ([next|discuss|plan|do|done|verify]); vypíše aktuální **session prompt na stdout** pro nativní `/mini:` slash commandy. Čte granulárně (hlavička + jen aktuální fáze). Buildery z `prompts/sessionContext.ts` (+ `autoPhase` pro `do`)
- `src/commands/init.ts` — interaktivní založení projektu (`init`) i headless `applyInit()` (z flagů). Založí project.md + stav + skeleton; brownfield → nabídne `map`/`audit`
- `src/commands/next.ts` — návrh další fáze (interaktivní `next` přes Claude) + `applyNewPhase(title, goal)` pro `--apply`
- `src/commands/plan.ts` — rozmen fáze na 3-7 kroků; `parseStepsFromStdin()` (formát `title :: detail`) + `applyPlanSteps()`
- `src/commands/do.ts` — interaktivní `doPhase` (`--stream`, `--max-turns`, acceptEdits) + headless `applyDoStart()` (fázi na `doing`, založí `.mini/run/`) a `applyStepDone(title)` (průběžné odškrtnutí kroku)
- `src/commands/done.ts` — finalizace fáze. `applyAutoReport()` čte `.mini/run/phase-{id}.md`, posune kroky, uzavře fázi; `applyDone()` (headless, `--accept-verify`/`--bump`/`--push`) **nepadá do interaktivu**, kdežto `done({auto})` ano. `finalizePhaseSideEffects()` → memory → graf → `save` → `commitPhaseWork` (bump verze, stamp changelog při vydání, jediný commit, opt-in `push` + `tagVersion`). `handleVerify()` řeší body k ručnímu ověření (pass/skip/issue/block, respektuje TTY přes `isInteractive` a `phase.resolvedVerify`); blocker → opravná podfáze s float ID (`insertFixSubphase`, 21 → 21.1). `closeOrphanedDoingParents` dozavře rodiče po hotových podfázích
- `src/commands/auto.ts` — chain `next → plan → (do → done){retry}` (interaktivní auto mód; samostatný od nativního `/mini:auto`, který řídí slash command)
- `src/commands/discuss.ts` — diskusní session (subprocess `claude`), Claude na konci zapíše poznámky do `.mini/discuss/phase-{id}.md`
- `src/commands/audit.ts` — spustí Clauda nad existujícím kódem, výstup `.mini/codebase.md` (TENTO soubor); blokovaný na greenfieldu
- `src/commands/map.ts` — `mini map` (plný rebuild přes `buildGraph()`), `--file <cesta>` (inkrementálně přes `updateGraphFile()`), `--hook` (cesta z PostToolUse JSON na stdin). Detekuje mapovatelný projekt, jinak nasměruje na `/graphify`
- `src/commands/stop.ts` — `mini stop` / `--clear`: zakládá/maže kooperativní stop signál `.mini/STOP` pro autonomní `/mini:auto`
- `src/commands/migrate.ts` — `mini migrate`: jednorázový převod monolitického `state.json` (v1) na layout v2 (hlavička + `phases/`). Crash-safe (hlavička až nakonec), idempotentní
- `src/commands/renumber.ts` — `mini migrate --renumber [--dry-run]`: přečíslování fází na souvislá celá čísla + sjednocení názvů souborů (orchestruje čistou logiku z `state/renumber.ts`)
- `src/commands/update.ts` — `mini update [--dry-run]`: srovná negenerovanou část projektu na aktuální verzi mini — `syncSkeleton()` (skeleton `.mini/`) + `installCommands()` (slash commandy). Idempotentní, nesahá na generované soubory
- `src/commands/install-commands.ts` — tenký **re-export shim** kvůli zpětné kompatibilitě (staré import path v testech); reálná logika generování commandů žije v `src/install/commands.ts`
- `src/commands/statusline.ts` — `mini statusline`: tenký IO wrapper status line pro Claude Code (čte status JSON ze stdin + transcript), deleguje na čistý modul `src/statusline/`. Importuje minimum (rychlý start, volá se při každém refreshi), nikdy nehází — při chybě nevypíše nic
- `src/commands/import-gsd.ts` — jednorázový import GSD projektu z `.planning/`; parsuje `NAME:`/`WHAT:`/`PHASES:`, mapuje statusy přes `STATUS_MAP`
- `src/commands/status.ts` — barevný přehled fází a kroků (picocolors) + hint na další akci
- `src/commands/undo.ts` — restore `state.prev.json` → `state.json` (a `phases-prev/` → `phases/`); když poslední fáze měla `autoCommit` a HEAD pořád sedí + čistý strom (`classifyRevert`), nabídne i `git reset --soft preSha`
- `src/commands/writeMemory.ts` — **není CLI command**, volá ho `done` po fázi. Zapíše `.mini/memory/phase-{id}.md` + aktualizuje `.mini/last-memory.md`. Default skládá soubor přímo v TS (`buildPhaseMemoryMarkdown`, bez Claude API); Clauda zavolá jen když je scope `memory` explicitně nastaven. Nice-to-have — nikdy nehází
- `src/commands/model.ts` — `mini model [scope] [name]`; per-scope override (`default`/`next`/`plan`/`do`/`importGsd`/`audit`/`memory`)

### Claude wrappery (`src/claude/`)
- `src/claude/ask.ts` — `claude -p --output-format json`, stdin prompt, parsuje `result`/`usage`/`cost`; default timeout 5 min
- `src/claude/work.ts` — `claude` s `stdio: 'inherit'` (plně interaktivní session); typ `PermissionMode`
- `src/claude/stream.ts` — `claude -p --output-format stream-json --verbose`, vlastní `createLineBuffer()` na NDJSON, `parseStreamEvent()` mapuje system-init/assistant/user/result do typovaných eventů s `RawEnvelope` pro raw přístup
- `src/claude/spawnError.ts` — `describeSpawnError()` / `CLAUDE_NOT_FOUND_MESSAGE`: sjednocená hláška při ENOENT (chybí `claude` v PATH) napříč ask/work/stream

### Prompts (`src/prompts/`) — čisté buildery, jeden soubor na prompt
- **`sessionContext.ts`** — session prompty pro nativní `/mini:` commandy (běží v Claude session, ukládají přes `--apply`): `buildNextSessionPrompt`, `buildPlanSessionPrompt`, `buildDoneSessionPrompt` (vč. instrukcí k CHANGELOG a bump/push), `buildVerifySessionPrompt`
- `graphHint.ts` — `GRAPH_USAGE_HINT`: sdílená instrukce „jak číst kód přes strojovou mapu" (index → mapy → cílený Read přes `@L` kotvy); použito v next/discuss/plan
- `auditCodebase.ts` (`buildAuditCodebasePrompt`, `CODEBASE_FILE = '.mini/codebase.md'`)
- `nextPhase.ts` — headless next; historie fází + `userHint`, výstup `TITLE:`/`GOAL:`
- `planPhase.ts` — headless plan; fáze + discuss notes, výstup `STEP:` řádky
- `doPhase.ts` — interaktivní `do`; vyznačuje `focusedStep`
- `autoPhase.ts` — auto/nativní `do`; vynucuje YAML front-matter report do `.mini/run/phase-{id}.md` (statusy kroků, `verdict`, sekce `verify`); podporuje `useDiscussNotesRef`/`useProjectRef` (reference mód) a `AutoPhaseRetryContext`
- `discussPhase.ts` — diskuse + povinný zápis poznámek
- `importGsd.ts` — kostra GSD projektu (`NAME:`/`WHAT:`/`FOR_WHOM:`/`CONSTRAINTS:`/`PHASES:`)
- `writeMemory.ts` (`buildWriteMemoryPrompt`, `MEMORY_DIR = '.mini/memory'`, `LAST_MEMORY_FILE = '.mini/last-memory.md'`) — prompt pro Claude režim zápisu paměti; jen při explicitním `memory` scope

### Git (`src/git.ts`)
- Tenký wrapper nad `git` subprocess (`execFile`). `runGit()` nikdy nehází — `ok: false` pokrývá nenulový exit i ENOENT. Helpery: `isGitRepo`/`hasChanges`/`commitAll` (`add -A` + commit)/`push`/`createTag`/`pushTag`/`currentBranch`/`headSha`/`headParentSha`/`headSubject`/`isCleanWorkingTree`/`softResetTo` (`reset --soft`)

### Graph (`src/graph/`) — strojová mapa projektu (`.mini/graph/` + `.mini/graph.json`)
- `types.ts` — `FileGraph`, `ExportInfo`/`ExportKind`, `ImportInfo`, `FunctionSignature`/`MethodSignature`/`Parameter`
- `buildGraph.ts` — `GRAPH_DIR = '.mini/graph'`, `GRAPH_INDEX = '.mini/graph.json'`. `buildGraph()` posbírá mapovatelné soubory (v git repu přes `git ls-files`, jinak `walk` + `IGNORE_DIRS`), namapuje a atomicky zapíše **per-file mapy** (`.mini/graph/<cesta>.md`) + lehký JSON index. `updateGraphFile()` inkrementálně přemapuje jeden soubor (hot path pro `--hook`). `hasMappableProject()` detekuje konfig 10 jazyků nebo aspoň jeden mapovatelný soubor. Render přes `renderFileGraph()` s kotvami `@L<start>-<end>`. Starý monolitický `.mini/graph.md` (`LEGACY_GRAPH_FILE`) se maže
- Mappery (jeden na jazyk): `mapper.ts` (TS/TSX přes `ts.createSourceFile`), `phpMapper.ts`, `rustMapper.ts`, `pythonMapper.ts`, `goMapper.ts`, `javaMapper.ts`, `csharpMapper.ts`, `kotlinMapper.ts`, `swiftMapper.ts`, `rubyMapper.ts` (mimo TS jde o regex/textové mappery)

### State (`src/state/`)
- `types.ts` — layout **verze 2**: `Phase` (vč. `autoCommit: PhaseAutoCommit`, `humanNotes`, `resolvedVerify`, `detail` na kroku), `Step`, `PhaseAutoCommit` (`preSha`/`sha?`/`subject`), `ProjectState` (`version: 2`), `StateHeader` + `PhaseSummary` (lehký index v `state.json`), `ProjectModels`, statusy
- `store.ts` — `SCHEMA_VERSION = 2`, `LegacyStateError` (v1 → `mini migrate`). Granulární I/O: `loadHeader`/`saveHeader`, `loadPhase`/`savePhase`, `loadFullState` (= `load`), atomické zápisy (tmp+rename, `writeJsonIfChanged`). `save()` zazálohuje do `state.prev.json` + `phases-prev/` (diferenčně), rozseká stav na hlavičku + soubory fází, prune osiřelých. `phaseStem(id)` (padding `phase-001`), `stopPath`, `restorePrev`, `readProject`/`writeProject`, `newState`
- `renumber.ts` — čistá logika přečíslování (parser `parsePhaseFile`, `buildRenumberMap`, plánovače `planSimpleDir`/`planMemoryDir`, `findCollisions`, kolizně bezpečné `executeRenames` přes dočasné názvy)
- `models.ts` — `MODEL_SCOPES`, `SCOPE_LABELS`, `resolveModel` (per-scope → default → legacy `model`), `getDefaultModel`
- `brownfield.ts` — `isBrownfield(cwd)`; ignoruje VCS/build/cache adresáře
- `discussNotes.ts` — čtení `.mini/discuss/phase-{id}.md` (`null` při ENOENT)
- `runReport.ts` — kontrakt reportu z auto/do session: `RunStepStatus`/`RunVerdict`/`RunReport`/`RunReportVerifyItem`, vlastní minimální YAML parser, `parseRunReport()`/`readRunReport()` strict-validují phase ID + step titles, `RunReportParseError`, `runReportPath`/`runReportExists`

### UI (`src/ui/`)
- `log.ts` — `log.info/success/warn/error/dim/title/hint` s picocolors prefixy
- `ask.ts` — wrapper nad `prompts` s `onCancel → exit(130)`; helpers `nonEmpty()`, `trim()`
- `interactive.ts` — `isInteractive()` (TTY check); verify se bez TTY nezavře tiše jako pass
- `streamRender.ts` — `createStreamRenderer()` pro průběžný tisk stream eventů
- `usage.ts` — `logUsage()` / `logStreamSummary()` — tokeny, cache hits, USD náklad

### Tokens (`src/tokens/`)
- `measure.ts` — měření token ceny promptů příkazů (heuristika délka/4): `measureAll()`, rozpad na šablonu vs. vkládaný kontext po blocích, render do `.mini/token-report.md` i konzole. Runner: `scripts/measure-prompt-tokens.ts`

### Statusline (`src/statusline/`) — status line pro Claude Code
- `statusline.ts` — čistá logika bez I/O: typ `StatusInput` (JSON, který Claude Code posílá na stdin), `StatuslineData`, `buildData(input, transcript)`, `extractUsage()` (poslední `message.usage` z transcriptu), `windowForModel()` (200k vs. 1M podle modelu); ukazuje zkrácené cwd, model a využití context window
- `render.ts` — `renderStatusline(StatuslineData)` → finální jednořádkový string. Barvy přes **syrové ANSI escapy** (ne picocolors — Claude Code volá příkaz s pipnutým stdout), `color` opt-out kvůli snapshot testům; helpery `shortDir`/`windowLabel`/`usagePercent`/`usageBar`/`usageColor`

### Install (`src/install/`) — instalace slash commandů + npm postinstall
- `commands.ts` — **zdroj pravdy** generování commandů: `COMMAND_DEFS` (tělo každého `/mini:*`, vč. dlouhého těla `auto`), `renderCommandMd()`, `writeCommandsTo()` (idempotentní diff-based zápis, atomicky tmp+rename), `installCommands`, `COMMANDS_DIR = .claude/commands/mini`. Společné pro CLI, `mini update` i postinstall hook
- `install.ts` — sdílený instalátor `/mini:*`: `installSlashCommands()` (scope `project`/`user`, explicitní nebo interaktivně/detekcí), `resolveTarget`, `userCommandsDir`, typy `InstallScope`/`InstallResult`. Obsahuje i `offerStatusline()` — opt-in nabídka zadrátovat status line (jen s TTY a jen když uživatel `statusLine` ještě nemá)
- `postinstall.ts` — `runPostinstall()`: cílový (zkompilovaný) endpoint npm `postinstall` hooku + `isGlobalInstall()` (`npm_config_global`). Globální instalace bez TTY → tiše nainstaluje user-scope commandy a status line; lokální/CI bez TTY → jen hint; s TTY → interaktivně. Respektuje `MINI_SKIP_POSTINSTALL`, nikdy nepoloží instalaci
- `detectClaude.ts` — `detectClaude()` (najde `claude` v PATH = global, nebo `node_modules/.bin/claude` = local; čisté a synchronní, injektovatelné pro testy), `recommendedScope()`
- `statuslineSettings.ts` — čtení/zápis bloku `statusLine` v `~/.claude/settings.json`: `installStatusline()`, čistá `mergeStatusline()` (přidá jen když žádný `statusLine` není — nikdy nepřepíše cizí), `miniStatuslineCommand()` (absolutní `node <cli.js> statusline`). Zbytek settings zachová, nikdy nehází

## Technologie
- **Balík:** `mini-orchestrator` (npm), bin `mini` → `dist/cli.js`; publikuje se `dist` + `scripts/postinstall.mjs` + `README.md`, `prepublishOnly` buildí. Klíčová slova v `package.json` (`keywords`) pro npm search
- **Jazyk:** TypeScript 5.6, strict + `noUncheckedIndexedAccess` + `noImplicitOverride`, target ES2022, module NodeNext (čisté ESM s `.js` importy)
- **Runtime:** Node ≥20 (`engines`), `"type": "module"`
- **CLI framework:** [commander](https://www.npmjs.com/package/commander) ^12.1.0 (s `InvalidArgumentError` pro vlastní parsery `--max-turns`/`--bump`)
- **Interaktivní prompty:** [prompts](https://www.npmjs.com/package/prompts) ^2.4.2
- **Barvy:** [picocolors](https://www.npmjs.com/package/picocolors) ^1.1.1
- **TypeScript jako runtime dep:** balík `typescript` je v `dependencies` (ne jen dev) — `src/graph/mapper.ts` ho používá za běhu (`import ts`) k syntaktickému parsování TS/TSX do mapy (ostatní jazyky jdou přes vlastní regex mappery, bez deps)
- **Build:** `tsc -p tsconfig.build.json` + `scripts/copy-assets.mjs` (zkopíruje `assets/skeleton/` → `dist/skeleton/`); out `dist/`
- **Dev runner:** `tsx` (`npm run dev` = `tsx src/cli.ts`)
- **Test runner:** [vitest](https://vitest.dev/) ^4.1.7; ke každému modulu `*.test.ts`, snapshot testy v `__snapshots__/` (prompts, graph, tokens)
- **Externí závislost runtime:** binárka `claude` (Claude Code CLI) v `PATH` — subprocess režim (`do`/`discuss`/`audit`/`import-gsd`/`auto`) ji spawnuje; nativní `/mini:` commandy už běží uvnitř Claude Code a `claude` nespouštějí
- **Volitelná externí závislost:** binárka `git` — auto-commit/push/tag po fázi a soft reset v undo (`src/git.ts`); chybí-li, side-effecty se tiše přeskočí
- **Instalace:** `npm install -g mini-orchestrator` (publish vyžaduje 2FA OTP); pro vývoj `npm run install-local` (`scripts/install-local.sh`). Po globální instalaci npm `postinstall` hook (`scripts/postinstall.mjs` → `dist/install/postinstall.js`) sám nainstaluje user-scope slash commandy a (interaktivně) nabídne zadrátování status line; nikdy nepoloží instalaci (CI/`npm ci`/bez TTY → jen hint nebo no-op)
- **Nativní integrace s Claude Code:** `/mini:*` slash commandy v `.claude/commands/mini/*.md` (postinstall / skrytý `mini install-commands` / `mini update`) volají `mini context <cmd>`; volitelný PostToolUse hook na `mini map --hook` udržuje graf aktuální; `mini statusline` jako `statusLine` v `settings.json` ukazuje cwd/model/context window
