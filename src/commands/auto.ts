import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { AutoPhaseRetryContext } from '../prompts/autoPhase.js';
import {
  RUN_DIR,
  previousRunReportPath,
  runReportPath,
} from '../state/runReport.js';
import { exists, load, phaseStem } from '../state/store.js';
import { log } from '../ui/log.js';
import { doPhase } from './do.js';
import { done } from './done.js';
import { next } from './next.js';
import { plan } from './plan.js';
import type { AutoOptions } from './types.js';

/**
 * Maximum number of Claude session passes per phase in auto mode.
 *
 * Auto runs Claude on the whole phase in a single pass. If after `done({auto})`
 * steps with the `todo` status remain (Claude didn't finish, hit a blocker,
 * etc.), another attempt is started — at most as many as this constant says.
 * After the limit is exhausted, auto ends with a warning and hands the baton to
 * a human.
 */
const MAX_PHASE_ITERATIONS = 3;

export async function auto(opts: AutoOptions = {}): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return;
  }

  let state = await load(cwd);
  let currentPhase =
    state.currentPhaseId !== null ? state.phases.find((p) => p.id === state.currentPhaseId) : undefined;

  const needsNewPhase =
    !currentPhase || currentPhase.status === 'done' || currentPhase.status === 'skipped';

  if (needsNewPhase) {
    log.title('[auto 1/4] Suggesting the next phase');
    const r = await next({ auto: true });
    if (!r.ok) {
      log.dim(`Auto stopped at next (${r.reason}).`);
      return;
    }
    state = await load(cwd);
    currentPhase = state.phases.find((p) => p.id === state.currentPhaseId);
    if (!currentPhase) {
      log.error('Something went wrong (the new phase is not found in the state).');
      return;
    }
  } else if (currentPhase) {
    log.title(`[auto 1/4] Continuing the in-progress phase ${currentPhase.id}: ${currentPhase.title}`);
  }

  if (!currentPhase) {
    return;
  }

  if (!currentPhase.steps?.length) {
    log.title('[auto 2/4] Breaking the phase down into steps');
    const r = await plan({ auto: true });
    if (!r.ok) {
      log.dim(`Auto stopped at plan (${r.reason}).`);
      return;
    }
  } else {
    log.title(`[auto 2/4] Phase already has ${currentPhase.steps.length} ${currentPhase.steps.length === 1 ? 'step' : 'steps'} — planning skipped.`);
  }

  // One Claude session = the whole phase. If after verification via `done({auto})`
  // unclosed steps remain, we run another attempt (up to MAX_PHASE_ITERATIONS).
  // The second and third pass get a retry context — Claude then sees in the
  // prompt that it is continuing a previous attempt and finds there a path to
  // the backed-up report.
  let iteration = 0;
  while (true) {
    iteration += 1;

    const retry = iteration > 1 ? await prepareRetryContext(cwd, currentPhase.id, iteration) : null;

    const labelSuffix =
      iteration === 1 ? '' : ` — attempt ${iteration}/${MAX_PHASE_ITERATIONS}`;
    log.title(`[auto 3/4] Running Claude Code (acceptEdits)${labelSuffix}`);
    const dr = await doPhase({ auto: true, maxTurns: opts.maxTurns, retry });
    if (!dr.ok) {
      log.dim(`Auto stopped at do (${dr.reason}).`);
      return;
    }

    log.title(`[auto 4/4] Verification${labelSuffix}`);
    const fr = await done({ auto: true, bump: opts.bump, push: opts.push });
    if (!fr.ok) {
      log.dim(`Auto stopped at done (${fr.reason}).`);
      return;
    }
    if (fr.phaseAdvanced) {
      if (fr.nextPhaseId === null || fr.nextPhaseId === undefined) {
        log.success('Auto done. No further phase in the plan — run: mini next.');
      } else {
        log.success(`Auto done. Continuing with phase ${fr.nextPhaseId} — run: mini auto.`);
      }
      return;
    }

    if (iteration >= MAX_PHASE_ITERATIONS) {
      log.warn(
        `After ${MAX_PHASE_ITERATIONS} attempts phase ${currentPhase.id} is still not done. Check the report in .mini/run/ and continue manually via mini do / mini done.`,
      );
      return;
    }
    log.dim(`Phase ${currentPhase.id} is still not done — starting another attempt.`);
  }
}

/**
 * Prepares the inputs for a retry: renames the current report to `.prev.md`, so
 * Claude can read it without colliding with the new write. When the report does
 * not exist (Claude ended the previous session without writing — crash, /exit,
 * exhausted `--max-turns`), the retry runs without the previous report's
 * context; Claude reads the step statuses from the "Steps" block in the prompt.
 */
async function prepareRetryContext(
  cwd: string,
  phaseId: number,
  iteration: number,
): Promise<AutoPhaseRetryContext | null> {
  const current = runReportPath(cwd, phaseId);
  const previous = previousRunReportPath(cwd, phaseId);
  try {
    await rename(current, previous);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
  return {
    iteration,
    previousReportPath: join(RUN_DIR, `${phaseStem(phaseId)}.prev.md`),
  };
}
