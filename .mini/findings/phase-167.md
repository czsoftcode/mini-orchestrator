# Review findings

> Recorded by `mini findings add` (the adversarial and verify review steps).
> Each entry is `## <id> · <severity> · <status>`; do not hand-edit those header
> lines.

## 167-1 · blocker · resolved
**Where:** src/state/store.ts:178-194,346
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
Corrupt phase-detail JSON silently degrades to header, next save makes loss permanent

readPhaseFile wraps JSON.parse in try/catch returning null; assembleState then does phases.push(detail ?? {id,title,status}), so a corrupt/half-written/merge-conflicted .mini/phases/phase-NNN.json silently degrades to the header summary, dropping goal/steps/humanNotes/autoCommit/resolvedVerify with NO error. Realistic trigger: a git merge conflict in a phase file (the project explicitly resolves .mini conflicts via git) leaves conflict markers => invalid JSON => silent degradation. Worse, the normal load->mutate->save flow then writes the truncated in-memory phase back, making the data loss PERMANENT. Loader treats 'file unreadable' identically to 'file absent'. No test covers a corrupt phase-detail file.

## 167-2 · should-know · open
**Where:** src/state/store.ts:362-370
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
undo (restorePrev) wipes all phase detail when phases-prev is missing but state.prev.json exists

restorePrev renames state.prev.json->state.json FIRST (irreversible), then rm(phasesDir), then rename(phasesPrevDir->phasesDir); on failure it just mkdirs an EMPTY phasesDir. If state.prev.json exists but .mini/phases-prev/ does not (manual deletion, or a prior half-completed op), undo moves the old header into place but leaves phases/ empty -> every phase silently degrades to header-only (goal/steps gone project-wide). No clean abort since the header rename already happened. Happy-path test only covers both prev artifacts present.

## 167-3 · should-know · open
**Where:** src/state/store.ts:119-130,213
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
Unchecked 'parsed as StateHeader' cast => malformed state.json throws opaque TypeError

loadHeader/loadPrev do an unchecked cast (parsed as StateHeader) with no shape validation, then assembleState does for (const summary of header.phases). A state.json that is valid JSON but wrong shape (e.g. phases missing/not an array) throws a raw TypeError deep in assembleState instead of a clear error. Separately migrateHeader mutates the parsed object in place but the migration is never persisted on a header-only load, so the legacy model field lingers on disk until a later full save. No test for malformed-shape state.json.

## 167-4 · should-know · open
**Where:** src/graph/rustMapper.ts:239-254
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
Rust mapper: '>' in '->' breaks param splitting, merges/loses parameters

splitTopLevelCommas treats '>' as a depth-closer (depth-- on } ) ] >). The '>' in a return arrow '->' has no matching '<', so depth goes to -1 and the real top-level comma between params is no longer at depth 0 and never splits. Confirmed: 'pub fn run(a: fn() -> u32, b: u32) {}' => parameters = [{name:'a', type:'fn() -> u32, b: u32'}] — the 'b' param is silently merged into a's type and lost. Same for '&dyn Fn() -> bool, x: i32' and 'impl Fn(u32) -> u32, ...'. Very common Rust (callbacks/iterators). No fixture contains '->' inside a param, so tests cannot catch it. The graph map shows wrong arity + garbage type.

## 167-5 · should-know · open
**Where:** src/graph/rustMapper.ts:227-237,352
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
Rust mapper: arrow in generic bound (<F: Fn() -> u32>) drops the entire signature

matchAngle counts only '<'/'>'. A generic bound containing a closure type has a bare '>' from '->', so matchAngle returns at that '>' instead of the real closing one; p then lands mid-generic-list, the stripped[p] !== '(' check fails and the fn returns {parameters:[]} with no return type. Confirmed: 'pub fn run<F: Fn() -> u32>(f: F, x: u32) -> u32 {0}' => signature {parameters:[]}. Plain 'HashMap<String,u32>' params balance so tests pass; the arrow-in-generics case is untested. Distinct code path from the param-splitter bug — fixing one does not fix the other.

## 167-6 · should-know · open
**Where:** src/graph/phpMapper.ts:257-326,264
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
PHP mapper silently drops enums and block-form namespaces (whole-file API vanishes)

extractPhpExports has regexes for class/interface/trait/function but none for PHP 8.1 'enum' — 'enum Suit: string { case Hearts=...; public function color() }' => exports:[] (enum and its public methods vanish). Also every export regex gates on depthAt(...) !== 0, so a block-form 'namespace Foo { class X {} function y() {} }' yields exports:[] (everything inside is at brace depth 1). Both are silent whole-symbol data loss; block-namespace is acknowledged in the file's own doc comment but enums are not. Fixtures use only statement-form 'namespace App\Service;' and no enum, so untested.

## 167-7 · should-know · open
**Where:** src/git.ts:18-39
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
git runGit: default 1MiB maxBuffer + no timeout + uniform error-swallowing => phase silently not committed / mini done hangs

execFileAsync sets no maxBuffer (Node default 1MiB) and no timeout. Any git call whose output exceeds 1MiB rejects, and the catch treats it identically to a normal non-zero exit, returning {ok:false}. Concrete: a phase touching vendored/generated dirs makes 'git status --porcelain' exceed 1MiB => hasChanges returns false (if !r.ok return false) => commitPhaseWork logs 'No changes — commit skipped' and the whole phase is silently NOT committed despite real changes. Also: missing git binary (ENOENT), git killed by signal, and maxBuffer overflow all collapse to ok:false, indistinguishable from 'not a repo'. With no timeout, a hanging pre-commit hook hangs mini done forever with no diagnostic. No test for huge output.

## 167-8 · should-know · open
**Where:** src/commands/undo.ts:161-185
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
undo identity is positional only: 'git commit --amend' after done is silently absorbed with a false 'undone' message

classifyRevert declares 'match' when headParentSha === autoCommit.preSha AND tree is clean, then softResetTo(preSha) — dropping whatever commit is on top, not provably mini's. autoCommit.sha is deliberately not stored (types.ts:34), so undo cannot confirm HEAD is the commit it created. Scenario: mini done commits (HEAD=M, parent=preSha); user runs 'git commit --amend' (HEAD=M', parent still preSha, tree clean); 'mini undo' sees parent===preSha, classifies match, soft-resets to preSha and discards M', reporting 'auto-commit undone' as if it were mini's. Content survives staged (soft reset), but the user's deliberate commit is gone and the success message lies about what was reverted.

## 167-9 · should-know · open
**Where:** src/commands/writeMemory.ts:100-117,159-172,391
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
No-API memory path silently writes near-empty memory when discuss/run reports are missing

In the default no-API branch, readFileOrEmpty swallows every read error to '' (ENOENT, permission, EISDIR — all). For a phase run via 'mini do' without discuss/plan, buildPhaseMemoryMarkdown omits both the Discussion and Run-report sections (gated on .trim()), writes the thin file, and log.success reports success. summarizeMemoryForNext then hits the anchor-less hardCap fallback and feeds that thin head into last-memory.md, so 'next' gets degraded memory with NO warning — 'phase genuinely had no discussion' is indistinguishable from 'report files not found'. The with/without-API branch selection and writeViaClaude failure path are entirely untested (tests cover only the two pure functions).

## 167-10 · should-know · open
**Where:** src/prompts/autoPhase.ts:185-187
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
escapeYamlDouble vs runReport parser: newline/tab/control or numeric-looking titles break the report round-trip => done always falls back to interactive

escapeYamlDouble escapes only backslash and double-quote, not \n \t \r. Step titles are arbitrary strings (from plan --apply stdin). A title with a newline renders into the YAML sample as a literal line break inside a double-quoted scalar; Claude is told to copy it verbatim. The strict report parser (runReport.ts unquoteDouble / matchKeyValue is per-line) cannot round-trip a multiline title, so parseRunReport's title-match fails and 'done --apply' silently falls back to interactive even though Claude did the work. Also parseScalar coerces an unquoted numeric-looking title (e.g. 42) to a number, which then fails the steps[].title type check — same break. The escape fn is half-done relative to the parser it feeds; only plain ASCII + backslash/quote are exercised by tests.

## 167-11 · nit · open
**Where:** src/prompts/nextPhase.ts:42,48
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
next/plan prompts interpolate user data without fencing; stray newline+marker can corrupt the line-based contract

The project relies on a line-prefix contract (TITLE:/GOAL:/STEP:) that parsers split on, but nextPhase/planPhase/discussPhase inline goal/title/userHint/notes verbatim with no escaping or fencing. A goal like 'Add login\nSTEP: drop X' or a userHint containing '"""' (nextPhase wraps userHint/lastMemory in triple-quote fences) puts a marker/fence-break at line start; Claude can echo it and the line-based next/plan parser treats the injected line as a real step/title. The user is also the 'attacker' so this is low-risk, but an accidental newline+keyword in a field silently mangles the proposed phase/steps. The auto path is better defended (escapeYamlDouble + strict YAML + title-match); next/plan/importGsd have no equivalent. No test feeds a marker-bearing field.

## 167-12 · nit · open
**Where:** src/ui/streamRender.ts:47-67,129-132
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
streamRender does not strip ANSI/C0/CR from tool output => live orchestrator view can be repainted/scrambled

shorten() collapses /\s+/ but does not remove ESC (0x1b), other C0 control chars, or CR. assistant text and tool-input/tool-result previews are printed raw into the live TTY (phase 4). A tool result echoing file/command output containing '0x1b[2J0x1b[H' (clear screen), a title-set sequence, or raw CR can repaint or scramble mini's own live display; bidi/zero-width chars survive '\s' and can visually reorder a shown path. Also slice(max) can split a surrogate pair and emit a lone surrogate. Display-robustness issue (NOT filed as security — that is a separate pass). Untested.

## 167-13 · nit · open
**Where:** src/ui/usage.ts:21,51
**Reviewed-at:** e69efefc1bdb235603a5eda7b87b080f6523fa2a
**Source:** adversarial
Sub-millidollar API cost renders as ~$0.000 (positive-cost label showing zero)

Guard is costUsd > 0 but the value is printed with toFixed(3); any 0 < cost < 0.0005 passes the guard and rounds to 0.000, e.g. costUsd 0.0004 => '~$0.000 in API'. The user sees a positive-cost label showing zero dollars. usage.test.ts only checks 0.0123 => 0.012, never a sub-milli value.
