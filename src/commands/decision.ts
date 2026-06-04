import { writeDecision } from '../state/decisionStore.js';
import { exists, load } from '../state/store.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

/**
 * Non-interactive write of the current phase's decision record (ADR) — for
 * `mini decision --apply` (called from `/mini:done` when Claude drafted an ADR
 * the user approved). The body is read from stdin by the CLI and passed in here.
 *
 * The target is the **current** phase (`currentPhaseId`), so this must run
 * **before** `mini done --apply` — afterwards the current phase points to the
 * next one. The same guards as `applyPlanSteps` apply (no project, no current
 * phase, inconsistent state); additionally a phase already `done` is rejected,
 * since the ADR must land in that phase's commit, which already happened.
 *
 * The empty-body and missing-heading guards live in `writeDecision`; here they
 * surface as a clean error + non-zero exit (the CLI calls `process.exit(1)`),
 * never a silently written empty file.
 */
export async function applyDecision(
  body: string,
  cwd: string = process.cwd(),
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

  if (phase.status === 'done' || phase.status === 'skipped') {
    log.info(`Phase ${phase.id} is no longer active (${phase.status}) — write the ADR before closing it.`);
    return { ok: false, reason: 'phase-not-active' };
  }

  const result = await writeDecision(cwd, phase.id, body);
  if (!result.ok) {
    if (result.reason === 'empty') {
      log.error('No decision body on stdin — nothing written.');
      log.hint('A phase with no real decision keeps no ADR; just run mini done --apply.');
    } else {
      log.error('The decision body has no top-level "# " heading — nothing written.');
      log.hint('Start the ADR with a "# <title>" line (then "## Decision" / "## Why").');
    }
    return { ok: false, reason: `decision-${result.reason}` };
  }

  log.success(`Decision record saved for phase ${phase.id} (${phase.title}).`);
  log.hint('It will land in the phase commit on mini done --apply.');
  return { ok: true };
}
