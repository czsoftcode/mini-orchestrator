import { streamWithClaude } from '../claude/stream.js';
import { workWithClaude } from '../claude/work.js';
import { buildAutoPhasePrompt, type AutoPhaseRetryContext } from '../prompts/autoPhase.js';
import { buildDoPhasePrompt } from '../prompts/doPhase.js';
import { readDiscussNotes } from '../state/discussNotes.js';
import { resolveModel } from '../state/models.js';
import { ensureRunDir } from '../state/runReport.js';
import { exists, load, readProject, save } from '../state/store.js';
import type { Step } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { createStreamRenderer } from '../ui/streamRender.js';
import { logStreamSummary } from '../ui/usage.js';
import type { AutoOptions, StepOutcome } from './types.js';

export interface DoPhaseOptions extends AutoOptions {
  /**
   * Context for a retry in auto mode. Set by `auto.ts` for the second and third
   * attempt — Claude then sees in the prompt that this is a repeat and finds
   * there a path to the previous report.
   */
  retry?: AutoPhaseRetryContext | null;
}

export async function doPhase(opts: DoPhaseOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

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
  if (phase.status === 'skipped') {
    log.info(`Phase ${phase.id} (${phase.title}) is deferred.`);
    log.hint('Run: mini next');
    return { ok: false, reason: 'phase-skipped' };
  }

  // In auto mode we run Claude on the whole phase in a single pass — we don't
  // pick a focusedStep. In interactive mode the step workflow stays: Claude gets
  // one specific step and afterwards the user verifies it manually via `mini done`.
  let focusedStep: Step | null = null;
  if (!opts.auto && phase.steps?.length) {
    focusedStep =
      phase.steps.find((s) => s.status === 'doing') ??
      phase.steps.find((s) => s.status === 'todo') ??
      null;
    if (!focusedStep) {
      log.info(`All steps of phase ${phase.id} are done (or deferred).`);
      log.hint('Run: mini done (mark the phase as done)');
      return { ok: false, reason: 'all-steps-done' };
    }
  }

  // In auto mode the "all steps done" safety check is done too, but differently —
  // without a step to focus on, Claude would just dry-generate an empty report.
  if (opts.auto && phase.steps?.length) {
    const stillOpen = phase.steps.some((s) => s.status !== 'done' && s.status !== 'skipped');
    if (!stillOpen) {
      log.info(`All steps of phase ${phase.id} are done (or deferred).`);
      log.hint('Run: mini done (mark the phase as done)');
      return { ok: false, reason: 'all-steps-done' };
    }
  }

  const discussNotes = await readDiscussNotes(cwd, phase.id);
  const prompt = opts.auto
    ? buildAutoPhasePrompt({ projectMd, phase, discussNotes, retry: opts.retry ?? null })
    : buildDoPhasePrompt({ projectMd, phase, focusedStep, discussNotes });

  if (opts.auto) {
    const modeNote = opts.stream ? ' (--stream, --permission-mode acceptEdits)' : ' (--permission-mode acceptEdits)';
    log.dim(`Auto: running Claude on the whole phase ${phase.id}${modeNote}.`);
  } else {
    console.log();
    log.title('This is what I will send to Claude Code as the first message:');
    console.log();
    console.log(prompt);

    const modeQuestion = opts.stream
      ? 'Run Claude in print mode with streamed JSON output?'
      : 'Run Claude Code with this prompt?';
    const { confirm } = await ask<'confirm'>({
      type: 'confirm',
      name: 'confirm',
      message: modeQuestion,
      initial: true,
    });

    if (!confirm) {
      log.dim('Cancelled. The phase status did not change.');
      return { ok: false, reason: 'cancelled' };
    }
  }

  phase.status = 'doing';
  if (!phase.startedAt) {
    phase.startedAt = new Date().toISOString();
  }
  if (focusedStep) {
    focusedStep.status = 'doing';
  }
  await save(state, cwd);

  // In auto mode Claude writes the report into `.mini/run/phase-{id}.md` at the
  // end of the session. We must create the directory up front — otherwise Claude
  // hits a missing path on Write.
  if (opts.auto) {
    await ensureRunDir(cwd);
  }

  if (!opts.auto) {
    log.dim(opts.stream ? 'Starting Claude Code (stream)…' : 'Starting Claude Code…');
  }
  console.log();

  const model = resolveModel('do', state);
  const permissionMode = opts.auto ? 'acceptEdits' : undefined;

  let exitCode: number;
  try {
    if (opts.stream) {
      const renderer = createStreamRenderer();
      const streamResult = await streamWithClaude(prompt, {
        cwd,
        permissionMode,
        model,
        maxTurns: opts.maxTurns,
        onEvent: renderer.onEvent,
        onParseError: (line, err) => {
          log.warn(`Unreadable line from the stream (${err.message}): ${line.slice(0, 120)}`);
        },
      });
      console.log();
      logStreamSummary(streamResult);
      exitCode = streamResult.exitCode;
    } else {
      const result = await workWithClaude(prompt, {
        cwd,
        permissionMode,
        model,
        maxTurns: opts.maxTurns,
      });
      exitCode = result.exitCode;
    }
  } catch (err) {
    log.error(`Failed to start Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Claude session finished.');
  } else {
    log.warn(`Claude session ended with code ${exitCode}.`);
  }
  if (!opts.auto) {
    log.hint('Next: mini done (verify and advance the state)');
  }
  return { ok: true };
}

/**
 * Non-interactive phase preparation before implementation in the session — for
 * `mini do --apply` (called by `/mini:do` before Claude starts working). Marks
 * the phase as `doing`, sets `startedAt`, and creates the `.mini/run/` directory
 * so Claude has somewhere to write the report. No Claude, no implementation.
 */
export async function applyDoStart(cwd: string = process.cwd()): Promise<StepOutcome> {
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
    return { ok: false, reason: 'phase-done' };
  }
  if (phase.status === 'skipped') {
    log.info(`Phase ${phase.id} (${phase.title}) is deferred.`);
    return { ok: false, reason: 'phase-skipped' };
  }

  phase.status = 'doing';
  if (!phase.startedAt) {
    phase.startedAt = new Date().toISOString();
  }
  await save(state, cwd);
  await ensureRunDir(cwd);

  log.success(`Phase ${phase.id} (${phase.title}) marked as in progress.`);
  return { ok: true };
}

/**
 * Finds a step by title tolerantly: first an exact match (after `trim`), then a
 * case-insensitive match. Returns `null` when nothing matches. Keeps the same
 * logic as title matching in the report — Claude copies the name from the
 * "Steps" section, but small deviations (spaces, case) must not break the write.
 */
function findStepByTitle(steps: Step[], title: string): Step | null {
  const wanted = title.trim();
  const exact = steps.find((s) => s.title.trim() === wanted);
  if (exact) return exact;
  const lower = wanted.toLowerCase();
  return steps.find((s) => s.title.trim().toLowerCase() === lower) ?? null;
}

/**
 * Non-interactive incremental write of one finished step — for `mini do --apply
 * --step-done "<name>"`. Called by Claude during `/mini:do` right after each
 * step is finished, so if the session crashes, `state.json` keeps a trace of how
 * far it got (unlike the final report, which is created only at the end).
 *
 * Marks the current phase's step `done` and saves the state immediately. When
 * the phase is not yet `doing` (e.g. the `/mini:do` slash command did not call
 * `mini do --apply` before the first `--step-done`), the function **lazily
 * starts it itself** — sets `doing`, fills in `startedAt`, and creates
 * `.mini/run/`. On an already closed phase (`done`/`skipped`) it still refuses
 * the write, so the status isn't written outside a live phase. It does not
 * advance the phase or set final statuses: those are still handled by `mini
 * done` from the report.
 */
export async function applyStepDone(title: string, cwd: string = process.cwd()): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const wanted = title.trim();
  if (wanted.length === 0) {
    log.error('Missing step name (--step-done "<name>").');
    return { ok: false, reason: 'no-step-title' };
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

  if (phase.status === 'done' || phase.status === 'skipped') {
    log.error(`Phase ${phase.id} is ${phase.status === 'done' ? 'done' : 'deferred'} (status: ${phase.status}).`);
    log.hint('Run: mini next');
    return { ok: false, reason: 'phase-closed' };
  }

  // Lazy start: when the phase hasn't started yet (the slash command did not call
  // `mini do --apply` before the first --step-done), we start it right here
  // instead of refusing the write. The incremental write thus succeeds on the
  // first try regardless of call order.
  if (phase.status !== 'doing') {
    phase.status = 'doing';
    if (!phase.startedAt) {
      phase.startedAt = new Date().toISOString();
    }
    await ensureRunDir(cwd);
  }

  if (!phase.steps?.length) {
    log.error(`Phase ${phase.id} has no steps.`);
    return { ok: false, reason: 'no-steps' };
  }

  const step = findStepByTitle(phase.steps, wanted);
  if (!step) {
    log.error(`Step "${wanted}" not found in phase ${phase.id}.`);
    log.hint('Use the exact step name from the "Steps" section in the prompt.');
    return { ok: false, reason: 'step-not-found' };
  }

  if (step.status === 'done') {
    log.dim(`Step "${step.title}" is already done.`);
    return { ok: true };
  }

  step.status = 'done';
  await save(state, cwd);

  log.success(`Step "${step.title}" marked as done.`);
  return { ok: true };
}
