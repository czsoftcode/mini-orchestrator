import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { commitAll, createTag, hasChanges, headSha, isGitRepo, push, pushTag } from '../git.js';
import { buildGraph, GRAPH_DIR, hasMappableProject } from '../graph/buildGraph.js';
import { CHANGELOG_FILE, stampUnreleased, todayIso } from '../changelog.js';
import { bumpProjectVersion } from '../projectVersion.js';
import type { BumpLevel } from '../version.js';
import {
  RunReportParseError,
  readRunReport,
  runReportPath,
  type RunReport,
  type RunReportVerifyItem,
} from '../state/runReport.js';
import { exists, load, save } from '../state/store.js';
import type { Phase, ProjectState, Step } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { isInteractive } from '../ui/interactive.js';
import { log } from '../ui/log.js';
import type { AutoOptions, FinalizeOptions, StepOutcome } from './types.js';
import { writePhaseMemory } from './writeMemory.js';

export async function done(opts: AutoOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const state = await load(cwd);

  if (state.currentPhaseId === null) {
    log.warn('No current phase.');
    log.hint('Run: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('State is inconsistent (currentPhaseId points to a non-existent phase).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done') {
    log.info(`Phase ${phase.id} (${phase.title}) is already done.`);
    log.hint('Run: mini next');
    return { ok: false, reason: 'phase-done' };
  }

  // In auto mode the phase status is advanced from the report Claude wrote at
  // the end of the session. When the report fits, we advance the statuses and
  // possibly finalize. When it is missing or broken, we drop into the
  // interactive fallback — we never mark anything blindly.
  if (opts.auto) {
    const applied = await applyAutoReport(phase, state, cwd);
    if (applied.handled) {
      return applied.outcome;
    }
    opts = { ...opts, auto: false };
  }

  const doingStep = phase.steps?.find((s) => s.status === 'doing') ?? null;
  if (doingStep) {
    const moreStepsAfter = (phase.steps ?? []).some(
      (s) => s !== doingStep && s.status !== 'done' && s.status !== 'skipped',
    );
    await finalizeStep(doingStep, moreStepsAfter, opts);
    await save(state, cwd);
    if (doingStep.status !== 'done' && doingStep.status !== 'skipped') {
      return { ok: true };
    }
    if (moreStepsAfter && !opts.auto) {
      log.hint('Next: mini do (continue with the next step)');
      return { ok: true };
    }
    if (moreStepsAfter) {
      // in auto mode: the step is done, but more steps remain — we don't finalize the phase yet
      return { ok: true };
    }
    // the step was the last one — we continue with finalizing the phase
  }

  const remainingSteps = (phase.steps ?? []).filter((s) => s.status !== 'done' && s.status !== 'skipped');
  if (remainingSteps.length > 0) {
    log.info(`Phase ${phase.id} (${phase.title}) has ${remainingSteps.length} ${remainingSteps.length === 1 ? 'unfinished step' : 'unfinished steps'}:`);
    for (const s of remainingSteps) {
      log.dim(`  - ${s.title}`);
    }
    console.log();

    if (opts.auto) {
      for (const s of remainingSteps) {
        s.status = 'skipped';
      }
      log.dim(`${remainingSteps.length} ${remainingSteps.length === 1 ? 'step' : 'steps'} marked as deferred.`);
      phase.status = 'done';
      phase.completedAt = new Date().toISOString();
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'done', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }

    const { decision } = await ask<'decision'>({
      type: 'select',
      name: 'decision',
      message: 'What do you want to do?',
      choices: [
        { title: 'Work on the next step', value: 'continue' },
        { title: 'Mark the phase as done (remaining steps → deferred)', value: 'force-done' },
        { title: 'Defer the phase (skip the whole thing)', value: 'force-skip' },
        { title: 'Cancel', value: 'cancel' },
      ],
    });

    if (decision === 'cancel') {
      log.dim('Nothing changed.');
      return { ok: false, reason: 'cancelled' };
    }
    if (decision === 'continue') {
      log.hint('Run: mini do');
      return { ok: true };
    }
    for (const s of remainingSteps) {
      s.status = 'skipped';
    }
    log.dim(`${remainingSteps.length} ${remainingSteps.length === 1 ? 'step' : 'steps'} marked as deferred.`);

    if (decision === 'force-skip') {
      phase.status = 'skipped';
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'skip', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }
    if (decision === 'force-done') {
      phase.status = 'done';
      phase.completedAt = new Date().toISOString();
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'done', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }
  }

  return finalizePhase(phase, state, cwd, opts);
}

async function collectNotesAndSave(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  outcome: 'done' | 'skip',
  opts: AutoOptions = {},
): Promise<Phase | null> {
  if (!opts.auto) {
    const { notes } = await ask<'notes'>({
      type: 'text',
      name: 'notes',
      message: 'Short note (what went well / what is wrong, can be left empty):',
      initial: '',
    });
    const trimmedNotes = (notes as string).trim();
    if (trimmedNotes) {
      phase.humanNotes = trimmedNotes;
    }
  }
  if (outcome === 'done') {
    log.success(`Phase ${phase.id} (${phase.title}) done.`);
  } else {
    log.warn(`Phase ${phase.id} deferred.`);
  }
  const next = advanceToNextPhase(state);
  logNextPhase(next);
  if (outcome === 'done') {
    await finalizePhaseSideEffects(phase, state, cwd, { bump: opts.bump, push: opts.push });
  }
  await save(state, cwd);
  return next;
}

function logNextPhase(next: Phase | null): void {
  if (next) {
    log.hint(`Continuing with phase ${next.id}: ${next.title}. Run: mini do`);
  } else {
    log.hint('No further phase in the plan. Run: mini next');
  }
}

/**
 * Builds the commit message for a finished phase. The subject is short and
 * unambiguous, the body (if any) adds the `humanNotes` the user wrote in `done`.
 * We deliberately leave the `goal` from the state out of the body — it would
 * duplicate `.mini/state.json`.
 */
export function buildPhaseCommitMessage(phase: Phase): string {
  const subject = `Phase ${phase.id}: ${phase.title}`;
  const body = phase.humanNotes?.trim();
  if (body) {
    return `${subject}\n\n${body}\n`;
  }
  return subject;
}

/**
 * Side effects that run after a phase is finalized as `done`. The order is
 * deliberate: the memory record, graph, and final `state.json` must all be
 * created **before** the single phase commit, so they land in it and after
 * `done` **nothing is left hanging** in the worktree into the next phase. The
 * commit is therefore the very last step.
 *
 * 1. **Preliminary auto-commit** — `phase.autoCommit` is set to `{ preSha,
 *    subject }` from the current HEAD (preSha = the target of a later `mini
 *    undo`). We don't store the resulting commit's own sha in the state — the
 *    commit will also carry `state.json`, so the record would depend on itself
 *    (see `PhaseAutoCommit`).
 * 2. **Memory record** (`writePhaseMemory`) — creates `.mini/memory/phase-XXX.md`
 *    and updates the summary in `.mini/last-memory.md`.
 * 3. **Graph regeneration** (`regenerateGraph`) — updates `.mini/graph/`
 *    + `.mini/graph.json` from the new state of the sources.
 * 4. **Saving state** (`save`) — `state.json` with the advance to `done` + `autoCommit`.
 * 5. **Commit** (`commitPhaseWork`) — a single `git add -A && commit` that picks
 *    up the code, tests, `state.json`, the per-phase json, memory, and graph.
 *    After it the tree is clean.
 *
 * A shared place so the call is not forgotten in any of the three finalization
 * paths in `done.ts` (`applyAutoReport`, `collectNotesAndSave`, `finalizePhase`).
 *
 * For a `skipped` phase this function is not called — neither a commit nor a
 * memory record makes sense.
 *
 * No side effect ever throws — errors are logged as a warning and the workflow
 * continues. If the commit fails, `commitPhaseWork` clears the preliminary
 * `autoCommit` again (there is no commit to revert).
 */
async function finalizePhaseSideEffects(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  finalizeOpts: FinalizeOptions = {},
): Promise<void> {
  if (await isGitRepo(cwd)) {
    const preSha = await headSha(cwd);
    if (preSha) {
      const subject = buildPhaseCommitMessage(phase).split('\n')[0] ?? '';
      phase.autoCommit = { preSha, subject };
    }
  }
  await writePhaseMemory(phase, state, cwd, { hasAutoCommit: phase.autoCommit !== undefined });
  await regenerateGraph(cwd);
  await save(state, cwd);
  await commitPhaseWork(phase, cwd, finalizeOpts);
}

/**
 * Best-effort regeneration of `.mini/graph/` + `.mini/graph.json` after a
 * finished phase. Never throws — on error we just log a warning and continue.
 * If the project has nothing to map (no TS/PHP/Rust files), we silently skip;
 * other languages are handled by `/graphify`.
 */
async function regenerateGraph(cwd: string): Promise<void> {
  try {
    if (!(await hasMappableProject(cwd))) {
      return;
    }
    const result = await buildGraph(cwd);
    const word = result.fileCount === 1 ? 'file' : 'files';
    log.dim(`${GRAPH_DIR}/: regenerated (${result.fileCount} ${word}).`);
  } catch (err) {
    log.warn(`Could not regenerate the project map: ${(err as Error).message}`);
  }
}

/**
 * The single phase commit (`phase.status === 'done'`). Never throws — git
 * errors are only logged as a warning, so an interrupted commit does not block
 * `mini done` (the user can commit manually).
 *
 * Called as the **very last** finalization step, when memory, graph, and
 * `state.json` (including the preliminary `phase.autoCommit`) already sit on
 * disk — `git add -A` thus picks them all up into a single commit and after
 * `done` nothing is left hanging in the worktree.
 *
 * Before committing it bumps the version in `package.json` (default `none`), so
 * `git add -A` picks it up into the commit. Push runs **only** with
 * `finalizeOpts.push` (opt-in) — otherwise it stays, as before, just a `git
 * push` hint.
 *
 * `phase.autoCommit` (preSha + subject) is already set from
 * `finalizePhaseSideEffects`; we don't put the commit's own sha into it (it is
 * inside this very commit). When the commit doesn't happen (no repo / no
 * changes / failure), the preliminary `autoCommit` is cleared again — undo
 * would have nothing to revert.
 */
async function commitPhaseWork(
  phase: Phase,
  cwd: string,
  finalizeOpts: FinalizeOptions = {},
): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    log.dim('Git repository not found — commit skipped.');
    delete phase.autoCommit;
    return;
  }

  // Bump the version before `hasChanges`/commit — it belongs in the phase
  // commit and is itself a change worth committing (even if there were nothing
  // else). We keep the resulting version for the tag on `--push` (below). The
  // default `none` doesn't bump the version (sub-phases) — then `version` stays
  // `null` and the tag/stamp is naturally skipped.
  const level = finalizeOpts.bump ?? 'none';
  const version = level === 'none' ? null : await bumpVersion(cwd, level);

  // On a release (minor/major with push) we fold `## [Unreleased]` into a dated
  // section — also before the commit, so it ends up in the phase commit.
  // Patches are not stamped: their entries accumulate in Unreleased until the
  // next release.
  if (finalizeOpts.push && (level === 'minor' || level === 'major')) {
    await stampChangelog(cwd, version);
  }

  if (!(await hasChanges(cwd))) {
    log.dim('No changes in git — commit skipped.');
    delete phase.autoCommit;
    return;
  }

  const message = buildPhaseCommitMessage(phase);
  const r = await commitAll(cwd, message);
  if (!r.ok) {
    log.warn('Git commit failed.');
    const detail = r.stderr.trim() || r.stdout.trim();
    if (detail) log.dim(detail);
    log.hint('You can finish the commit manually: git add -A && git commit');
    delete phase.autoCommit;
    return;
  }
  const subject = message.split('\n')[0] ?? message;
  log.success(`Commit: ${subject}`);

  // Push only on request (opt-in). Best-effort: a missing remote/upstream or a
  // rejection is only logged, the workflow is not blocked.
  if (finalizeOpts.push) {
    const pr = await push(cwd);
    if (pr.ok) {
      log.success('Pushed to remote.');
      await tagVersion(cwd, version);
    } else {
      log.warn('Push failed — the work stays committed locally.');
      const detail = pr.stderr.trim() || pr.stdout.trim();
      if (detail) log.dim(detail);
      log.hint('Try manually: git push (or set the upstream via git push -u).');
    }
  } else {
    log.hint('To upload to the remote run: git push (or mini done --push).');
  }
}

/**
 * On `--push`, after a successful push, creates and pushes a git tag `v<version>`
 * from the current version in `package.json`. Best-effort like the surrounding
 * push logic — git errors (an existing tag, a missing remote) are only logged
 * as a warning.
 *
 * When there is no version (`version === null` — the bump found nothing to
 * write), we silently skip; there is nothing to tag against.
 */
async function tagVersion(cwd: string, version: string | null): Promise<void> {
  if (!version) return;

  const tag = `v${version}`;
  const tr = await createTag(cwd, tag);
  if (!tr.ok) {
    log.warn(`Could not create tag ${tag} — version push skipped.`);
    const detail = tr.stderr.trim() || tr.stdout.trim();
    if (detail) log.dim(detail);
    return;
  }

  const ptr = await pushTag(cwd, tag);
  if (ptr.ok) {
    log.success(`Tag ${tag} pushed to remote.`);
  } else {
    log.warn(`Push of tag ${tag} failed — the tag stays local.`);
    const detail = ptr.stderr.trim() || ptr.stdout.trim();
    if (detail) log.dim(detail);
    log.hint(`Try manually: git push origin ${tag}.`);
  }
}

/**
 * Best-effort folding of `## [Unreleased]` in `CHANGELOG.md` into a dated
 * section `## [<version>] - <today>` on a release (minor/major with push).
 * Called before the phase commit, so the dated section ends up in the commit
 * that gets pushed.
 *
 * Never blocks done — a missing file, a missing `## [Unreleased]` section, or an
 * empty Unreleased is only logged. When there is no version (`version === null`
 * — the bump found nothing to write), we silently skip.
 */
async function stampChangelog(cwd: string, version: string | null): Promise<void> {
  if (!version) return;

  const path = join(cwd, CHANGELOG_FILE);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch {
    log.dim(`${CHANGELOG_FILE} not found — not stamping the version section.`);
    return;
  }

  const date = todayIso();
  const result = stampUnreleased(raw, version, date);
  if (!result.stamped) {
    if (result.reason === 'no-unreleased') {
      log.warn(`${CHANGELOG_FILE} has no "## [Unreleased]" section — not stamping the version.`);
    } else {
      log.dim(`${CHANGELOG_FILE}: "## [Unreleased]" is empty — not stamping the version.`);
    }
    return;
  }

  try {
    await writeFile(path, result.content, 'utf-8');
    log.dim(`${CHANGELOG_FILE}: "## [Unreleased]" → "## [${version}] - ${date}".`);
  } catch (err) {
    log.warn(`Writing ${CHANGELOG_FILE} failed: ${(err as Error).message}`);
  }
}

/**
 * Best-effort version bump before the phase commit. The version is written to
 * the place that matches the project's language (`package.json`, `Cargo.toml`,
 * `pyproject.toml`, `setup.py`, `composer.json`, `__version__`); when no known
 * manifest carries a version, the language-agnostic `VERSION` fallback file is
 * used (and created with `0.1.0` if missing) — see `bumpProjectVersion`. A read
 * or write error is only logged — it must not block finalization.
 */
async function bumpVersion(cwd: string, level: BumpLevel): Promise<string | null> {
  try {
    const r = await bumpProjectVersion(cwd, level);
    if (r) {
      if (r.created) {
        log.dim(`Version: created ${r.source} at ${r.to}.`);
      } else {
        log.dim(`Version: ${r.from} → ${r.to} (${level}, ${r.source}).`);
      }
      return r.to;
    }
  } catch (err) {
    log.warn(`Version bump failed: ${(err as Error).message}`);
  }
  return null;
}

export function advanceToNextPhase(state: ProjectState): Phase | null {
  closeOrphanedDoingParents(state);
  const nextPhase =
    state.phases.find(
      (p) => p.id !== state.currentPhaseId && (p.status === 'proposed' || p.status === 'planned'),
    ) ?? null;
  state.currentPhaseId = nextPhase ? nextPhase.id : null;
  return nextPhase;
}

/**
 * Closes orphaned parent phases. After a `block`-verify a fix sub-phase is
 * created (float ID) and `advanceToNextPhase` moves onto it — the parent stays
 * in the `doing` state (set in `do.ts`) and we never return to it again. As
 * soon as all its sub-phases are closed (`done`/`skipped`), the parent is done
 * (all its steps were already `done` before the sub-phase was created,
 * otherwise verify would not have run) — we close it as `done`. Called from
 * `advanceToNextPhase`, so the reconciliation runs after every finished phase.
 *
 * A top-level phase that is just being worked on normally (and has no
 * sub-phases) is unaffected — without sub-phases it is never closed here.
 */
function closeOrphanedDoingParents(state: ProjectState): void {
  for (const parent of state.phases) {
    if (parent.status !== 'doing') continue;
    const subs = state.phases.filter(
      (p) => p.id !== parent.id && Math.floor(p.id) === parent.id,
    );
    if (subs.length === 0) continue;
    if (!subs.every((s) => s.status === 'done' || s.status === 'skipped')) continue;
    parent.status = 'done';
    parent.completedAt = new Date().toISOString();
    log.success(`Phase ${parent.id} (${parent.title}) closed — fix sub-phase done.`);
  }
}

async function finalizeStep(step: Step, moreStepsLeft: boolean, opts: AutoOptions = {}): Promise<void> {
  let outcome: 'done' | 'keep' | 'skip';
  if (opts.auto) {
    outcome = 'done';
  } else {
    const answer = await ask<'outcome'>({
      type: 'select',
      name: 'outcome',
      message: `Step "${step.title}" — how did it go?`,
      choices: [
        { title: 'Done, works', value: 'done' },
        { title: 'Not yet, keep it doing', value: 'keep' },
        { title: 'Defer (skip)', value: 'skip' },
      ],
    });
    outcome = answer.outcome as 'done' | 'keep' | 'skip';
  }

  if (outcome === 'keep') {
    log.dim('The step stays as "doing".');
    return;
  }
  if (outcome === 'skip') {
    step.status = 'skipped';
    log.warn(`Step "${step.title}" deferred.`);
    return;
  }

  step.status = 'done';
  log.success(`Step "${step.title}" done.`);

  if (moreStepsLeft) {
    return;
  }

  log.info('That was the last step of the phase.');
}

type AutoApplyResult =
  | { handled: true; outcome: StepOutcome }
  | { handled: false };

export interface ApplyReportOptions extends FinalizeOptions {
  /**
   * Human verification (`verify` items) already happened outside this process —
   * typically in the Claude session via a chat question (`/mini:done`). When
   * `true`, pending verify items are not asked interactively but taken as
   * approved (pass).
   */
  acceptVerify?: boolean;
}

export async function applyAutoReport(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  applyOpts: ApplyReportOptions = {},
): Promise<AutoApplyResult> {
  const expectedStepTitles = (phase.steps ?? []).map((s) => s.title);
  const reportFile = runReportPath(cwd, phase.id);

  let report: RunReport | null;
  try {
    report = await readRunReport(cwd, {
      expectedPhaseId: phase.id,
      expectedStepTitles,
    });
  } catch (err) {
    if (err instanceof RunReportParseError) {
      log.warn(`Report for phase ${phase.id} is broken: ${err.message}`);
      log.dim(`File: ${reportFile}`);
      log.dim('Switching to interactive mode — we will go through the steps manually.');
      return { handled: false };
    }
    throw err;
  }

  if (!report) {
    log.warn(`Report for phase ${phase.id} not found (${reportFile}).`);
    log.dim('Switching to interactive mode — we will go through the steps manually.');
    return { handled: false };
  }

  for (const reported of report.steps) {
    const step = phase.steps?.find((s) => s.title === reported.title);
    if (!step) continue;
    if (reported.status === 'done') {
      step.status = 'done';
    } else if (reported.status === 'skipped') {
      step.status = 'skipped';
    } else {
      // `blocked` and `todo` both mean the step is not closed — a retry attempt
      // finds it as `todo` and sends it to Claude again.
      step.status = 'todo';
    }
  }

  const remaining = (phase.steps ?? []).filter(
    (s) => s.status !== 'done' && s.status !== 'skipped',
  );

  if (!phase.steps?.length) {
    if (report.verdict !== 'done') {
      log.warn(`Phase ${phase.id}: report verdict is "${report.verdict}" — not closing the phase.`);
      await save(state, cwd);
      return { handled: true, outcome: { ok: true } };
    }
  } else if (remaining.length > 0) {
    log.warn(
      `Phase ${phase.id}: ${remaining.length} ${remaining.length === 1 ? 'unfinished step' : 'unfinished steps'} remaining (verdict: ${report.verdict}).`,
    );
    for (const s of remaining) {
      log.dim(`  - ${s.title}`);
    }
    await save(state, cwd);
    return { handled: true, outcome: { ok: true } };
  }

  // Items for manual verification are shown only here — all steps are closed and
  // we would otherwise close the phase right away. Even in auto mode we stop
  // here and ask a human (an `ask()` call); the auto loop does not bypass verify.
  const verifyOutcome = await handleVerify(report.verify, phase, state, cwd, applyOpts);
  if (verifyOutcome) {
    return { handled: true, outcome: verifyOutcome };
  }

  phase.status = 'done';
  phase.completedAt = new Date().toISOString();
  log.success(`Phase ${phase.id} (${phase.title}) done.`);
  const nextPhase = advanceToNextPhase(state);
  logNextPhase(nextPhase);
  await finalizePhaseSideEffects(phase, state, cwd, { bump: applyOpts.bump, push: applyOpts.push });
  await save(state, cwd);
  return {
    handled: true,
    outcome: { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null },
  };
}

/**
 * Goes through the items for manual verification (`verify` from the report)
 * with a human. Called only when closing the phase, when all steps are done.
 * Returns:
 *
 * - `null` — no verify items, or all `pass`/`skip`: the phase can be closed,
 * - `{ ok: false, reason: 'verify-issue' }` — at least one `issue` (and no
 *   blocker): we don't close the phase, the user closes it again after the fix
 *   (`mini done`),
 * - `{ ok: true, phaseAdvanced: true, ... }` — at least one `block`: we create
 *   a fix sub-phase (float ID) and move onto it.
 *
 * Even in auto mode `ask()` is called here — verify is never bypassed
 * automatically. Without an interactive terminal (CI, pipe) `ask()` is not
 * called at all: we don't close the phase and return `verify-needs-human`, so
 * verify does not silently pass.
 *
 * Items the human already resolved in a previous pass (`pass`/`skip`) are
 * remembered in `phase.resolvedVerify` — on a repeated `mini done` over the same
 * report they are not offered again.
 */
async function handleVerify(
  verify: RunReportVerifyItem[],
  phase: Phase,
  state: ProjectState,
  cwd: string,
  applyOpts: ApplyReportOptions = {},
): Promise<StepOutcome | null> {
  // Items resolved by an earlier pass (pass/skip) are skipped — a repeated
  // `mini done` over an unchanged report must not replay them (W4).
  const alreadyResolved = new Set(phase.resolvedVerify ?? []);
  const pending = verify.filter((v) => !alreadyResolved.has(v.title));
  if (pending.length === 0) {
    return null;
  }

  // `/mini:done`: human verification happened in the chat, the approval arrived
  // here via `--accept-verify`. We take the items as pass (remember them in
  // resolvedVerify so we don't ask again on a repeat) and let the phase close.
  if (applyOpts.acceptVerify) {
    phase.resolvedVerify = [...(phase.resolvedVerify ?? []), ...pending.map((v) => v.title)];
    return null;
  }

  // Without a TTY `ask()` can't be used safely (returns undefined → silent
  // pass). We therefore don't close the phase and hand the baton to a human in
  // an interactive run.
  if (!isInteractive()) {
    const w =
      pending.length === 1 ? 'item for manual verification' : 'items for manual verification';
    log.warn(
      `Phase ${phase.id} (${phase.title}): ${pending.length} ${w} require a human, but I'm running without an interactive terminal — not closing the phase.`,
    );
    for (const it of pending) {
      log.dim(`  - ${it.title}`);
    }
    log.hint('Run `mini done` (or `mini auto`) in a terminal and verify the items manually.');
    await save(state, cwd);
    return { ok: false, reason: 'verify-needs-human' };
  }

  const word = pending.length === 1 ? 'item for manual verification' : 'items for manual verification';
  log.info(`Phase ${phase.id} (${phase.title}): ${pending.length} ${word} (Claude did not verify them itself):`);
  console.log();

  const blockers: RunReportVerifyItem[] = [];
  const issues: RunReportVerifyItem[] = [];
  const newlyResolved: string[] = [];

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]!;
    log.info(`  ${i + 1}. ${item.title}`);
    if (item.detail) {
      log.dim(`     ${item.detail}`);
    }
    const { answer } = await ask<'answer'>({
      type: 'select',
      name: 'answer',
      message: 'Verified?',
      choices: [
        { title: 'Yes, works (pass)', value: 'pass' },
        { title: 'Skip verification, I take responsibility (skip)', value: 'skip' },
        { title: 'Minor problem — I want to fix it (issue)', value: 'issue' },
        { title: 'Serious blocker — create a fix sub-phase (block)', value: 'block' },
      ],
    });
    if (answer === 'issue') {
      issues.push(item);
    } else if (answer === 'block') {
      blockers.push(item);
    } else {
      // pass | skip — the item is resolved, so it is not offered again next time.
      newlyResolved.push(item.title);
    }
  }

  if (newlyResolved.length > 0) {
    phase.resolvedVerify = [...(phase.resolvedVerify ?? []), ...newlyResolved];
  }

  // A blocker takes precedence: we create a fix sub-phase and move onto it.
  if (blockers.length > 0) {
    const sub = insertFixSubphase(state, phase, blockers);
    log.warn(
      `Phase ${phase.id} is not being closed — ${blockers.length === 1 ? 'a blocker was' : 'blockers were'} found. I created fix sub-phase ${sub.id}.`,
    );
    for (const s of sub.steps ?? []) {
      log.dim(`  - ${s.title}`);
    }
    const next = advanceToNextPhase(state);
    logNextPhase(next);
    await save(state, cwd);
    return { ok: true, phaseAdvanced: true, nextPhaseId: next?.id ?? null };
  }

  // Minor problems without a blocker: we don't close the phase, the user closes it again after the fix.
  if (issues.length > 0) {
    log.warn(
      `Phase ${phase.id} is not being closed — ${issues.length === 1 ? 'an item has a problem' : 'items have a problem'}:`,
    );
    for (const it of issues) {
      log.dim(`  - ${it.title}`);
    }
    log.hint('Fix the listed items (`mini do`) and then close the phase again (`mini done`).');
    await save(state, cwd);
    return { ok: false, reason: 'verify-issue' };
  }

  // All items pass/skip — the phase can be closed.
  return null;
}

/**
 * Inserts a fix sub-phase right after the parent phase in `phases`. Float ID
 * (21 → 21.1 → 21.2…), status `planned`, steps mechanically from the blockers
 * (each blocker → one step). The physical position after the parent matters:
 * `advanceToNextPhase` takes the first `proposed/planned` phase in array order,
 * so the sub-phase must stand right after the parent, otherwise it would be
 * skipped.
 */
function insertFixSubphase(
  state: ProjectState,
  parent: Phase,
  blockers: RunReportVerifyItem[],
): Phase {
  const id = nextSubphaseId(state, parent.id);
  const steps: Step[] = blockers.map((b) => ({
    title: b.title,
    status: 'todo' as const,
    ...(b.detail ? { notes: b.detail } : {}),
  }));
  const sub: Phase = {
    id,
    title: `Fix: ${parent.title}`,
    goal: `Resolve the blockers from manual verification of phase ${parent.id}.`,
    status: 'planned',
    steps,
  };
  const idx = state.phases.findIndex((p) => p.id === parent.id);
  state.phases.splice(idx + 1, 0, sub);
  return sub;
}

/**
 * The next free float ID of a sub-phase for the given parent. 21 without
 * sub-phases → 21.1, otherwise the highest existing one + 0.1 (rounded to one
 * decimal place, so float arithmetic doesn't give 21.200000000000003).
 */
function nextSubphaseId(state: ProjectState, parentId: number): number {
  const subs = state.phases.filter(
    (p) => Math.floor(p.id) === parentId && p.id !== parentId,
  );
  const base = subs.length === 0 ? parentId : Math.max(...subs.map((p) => p.id));
  return Math.round((base + 0.1) * 10) / 10;
}

async function finalizePhase(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  opts: AutoOptions = {},
): Promise<StepOutcome> {
  let outcome: 'done' | 'keep' | 'skip';
  if (opts.auto) {
    outcome = 'done';
  } else {
    const answer = await ask<'outcome'>({
      type: 'select',
      name: 'outcome',
      message: `Phase ${phase.id} (${phase.title}) — what do you want to do with it?`,
      choices: [
        { title: 'Done, works', value: 'done' },
        { title: 'Not yet, keep it doing', value: 'keep' },
        { title: 'Defer (skip the phase)', value: 'skip' },
      ],
    });
    outcome = answer.outcome as 'done' | 'keep' | 'skip';
  }

  if (outcome === 'keep') {
    log.dim('The phase stays in progress.');
    return { ok: true };
  }

  if (!opts.auto) {
    const { notes } = await ask<'notes'>({
      type: 'text',
      name: 'notes',
      message: 'Short note (what went well / what is wrong, can be left empty):',
      initial: '',
    });
    const trimmedNotes = (notes as string).trim();
    if (trimmedNotes) {
      phase.humanNotes = trimmedNotes;
    }
  }

  if (outcome === 'skip') {
    phase.status = 'skipped';
    log.warn(`Phase ${phase.id} deferred.`);
  } else {
    phase.status = 'done';
    phase.completedAt = new Date().toISOString();
    log.success(`Phase ${phase.id} (${phase.title}) done.`);
  }

  const next = advanceToNextPhase(state);
  logNextPhase(next);
  if (phase.status === 'done') {
    await finalizePhaseSideEffects(phase, state, cwd, { bump: opts.bump, push: opts.push });
  }
  await save(state, cwd);
  return { ok: true, phaseAdvanced: true, nextPhaseId: next?.id ?? null };
}

/**
 * Non-interactive state advance from the report — for `mini done --apply`
 * (called by `/mini:done` when the user confirmed in the session that the phase
 * works). Shares `applyAutoReport` with auto mode: reads the report, advances
 * the steps, and possibly closes the phase (commit + memory + graph + advance to
 * the next one). Unlike `done({auto})` it **does not drop into the interactive
 * fallback** — when the report is missing or broken, it returns an error so the
 * Bash call fails cleanly instead of hanging on `ask()`.
 */
export async function applyDone(
  cwd: string = process.cwd(),
  opts: ApplyReportOptions = {},
): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const state = await load(cwd);

  if (state.currentPhaseId === null) {
    log.warn('No current phase.');
    log.hint('Run: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('State is inconsistent (currentPhaseId points to a non-existent phase).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done') {
    log.info(`Phase ${phase.id} (${phase.title}) is already done.`);
    log.hint('Run: mini next');
    return { ok: false, reason: 'phase-done' };
  }

  const applied = await applyAutoReport(phase, state, cwd, opts);
  if (!applied.handled) {
    log.error(`Report for phase ${phase.id} is missing or broken — I can't advance the state non-interactively.`);
    log.hint('First run `/mini:do` (it writes the report), or advance the state manually via `mini done`.');
    return { ok: false, reason: 'no-report' };
  }
  // The phase really closed (not just verify-needs-human etc.) → offer to clear
  // the context. `/clear` must be typed by a human, we only remind them.
  if (applied.outcome.ok && applied.outcome.phaseAdvanced) {
    log.hint('Done. To clear the Claude Code context before the next phase, consider `/clear`.');
  }
  return applied.outcome;
}
