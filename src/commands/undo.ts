import { headParentSha, isCleanWorkingTree, isGitRepo, softResetTo } from '../git.js';
import { exists, hasPrev, load, loadPrev, restorePrev } from '../state/store.js';
import type { PhaseAutoCommit, ProjectState } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';

/**
 * Decision whether a soft reset of the auto-commit can be performed safely.
 *
 * `match` — the phase commit is still on top (`HEAD^ === autoCommit.preSha`) and
 * the working tree is clean; undo can drop the commit via `git reset --soft preSha`.
 *
 * `mismatch` — either HEAD has moved (the user committed something else in the
 * meantime), or there are unstaged changes / untracked files in the working tree.
 * In both cases undo leaves the commit alone and only reverts state.json — we show
 * the user a hint.
 */
type RevertDecision =
  | { kind: 'none' }
  | { kind: 'match'; autoCommit: PhaseAutoCommit }
  | { kind: 'mismatch'; autoCommit: PhaseAutoCommit; reason: string };

export interface UndoOptions {
  /**
   * Preview only — print the change summary (the same block as the interactive
   * prompt) and exit without prompting or touching anything. Serves the
   * non-interactive `/mini:undo` slash command, which shows the preview in the
   * chat before confirming. Cannot be combined meaningfully with `yes`.
   */
  dryRun?: boolean;
  /**
   * Skip the `Proceed?` confirmation and apply directly. For non-interactive use
   * (the `/mini:undo` slash command applies after the user confirmed in the chat).
   */
  yes?: boolean;
}

export async function undo({ dryRun = false, yes = false }: UndoOptions = {}): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('There is no project in this directory.');
    return;
  }
  if (!(await hasPrev(cwd))) {
    log.warn('Nothing to undo (no previous state version).');
    log.hint('Mini remembers only one step back.');
    return;
  }

  const [current, prev] = await Promise.all([load(cwd), loadPrev(cwd)]);
  const summary = describeDiff(current, prev);
  const autoCommit = findRevertedAutoCommit(current, prev);
  const decision = await classifyRevert(cwd, autoCommit);

  console.log();
  log.title(dryRun ? 'Undo would revert the last change:' : 'Undo the last change?');
  log.dim(`  ${summary}`);
  if (decision.kind === 'match') {
    log.dim(`  + revert commit: ${decision.autoCommit.subject} (soft reset to ${shortSha(decision.autoCommit.preSha)})`);
  } else if (decision.kind === 'mismatch') {
    log.dim(`  commit "${decision.autoCommit.subject}" stays (${decision.reason}).`);
  }
  console.log();

  if (dryRun) {
    log.dim('Preview only — nothing changed. Run "mini undo --yes" to apply.');
    return;
  }

  if (!yes) {
    const { confirm } = await ask<'confirm'>({
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed?',
      initial: true,
    });
    if (!confirm) {
      log.dim('Nothing changes.');
      return;
    }
  }

  await restorePrev(cwd);

  if (decision.kind === 'match') {
    const r = await softResetTo(cwd, decision.autoCommit.preSha);
    if (r.ok) {
      log.success('State reverted and auto-commit undone (soft reset, changes kept in the index).');
    } else {
      log.warn('State reverted, but the commit soft reset failed.');
      const detail = r.stderr.trim() || r.stdout.trim();
      if (detail) log.dim(detail);
      log.hint(`Undo the commit manually: git reset --soft ${decision.autoCommit.preSha}`);
    }
  } else if (decision.kind === 'mismatch') {
    log.success('State reverted by one step.');
    log.warn(`Auto-commit "${decision.autoCommit.subject}" stayed in git (${decision.reason}).`);
    log.hint(`If you want to undo it too, manually: git reset --soft ${decision.autoCommit.preSha}`);
  } else {
    log.success('State reverted by one step.');
  }

  log.hint('Mini remembers only one step back — another undo will do nothing.');
}

/**
 * Looks for a phase that got a new `autoCommit` in `current` but had none (or a
 * different one) in `prev`. That is a signal that `mini done` auto-committed in
 * the last step and `undo` may offer to revert it.
 *
 * We compare the auto-commit identity via `preSha` (the soft reset target), not
 * via `sha` — new phases do not store that in `state.json` (the commit would
 * carry its own sha; see `PhaseAutoCommit`).
 */
function findRevertedAutoCommit(
  current: ProjectState,
  prev: ProjectState,
): PhaseAutoCommit | null {
  for (const p of current.phases) {
    if (!p.autoCommit) continue;
    const pp = prev.phases.find((x) => x.id === p.id);
    if (!pp?.autoCommit || pp.autoCommit.preSha !== p.autoCommit.preSha) {
      return p.autoCommit;
    }
  }
  return null;
}

async function classifyRevert(
  cwd: string,
  autoCommit: PhaseAutoCommit | null,
): Promise<RevertDecision> {
  if (!autoCommit) return { kind: 'none' };
  if (!(await isGitRepo(cwd))) {
    return { kind: 'mismatch', autoCommit, reason: 'not in a git repo' };
  }
  const parent = await headParentSha(cwd);
  if (parent !== autoCommit.preSha) {
    return {
      kind: 'mismatch',
      autoCommit,
      reason: 'HEAD has moved since',
    };
  }
  if (!(await isCleanWorkingTree(cwd))) {
    return {
      kind: 'mismatch',
      autoCommit,
      reason: 'the working tree has unsaved changes',
    };
  }
  return { kind: 'match', autoCommit };
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function describeDiff(current: ProjectState, prev: ProjectState): string {
  const parts: string[] = [];

  if (current.phases.length !== prev.phases.length) {
    const diff = current.phases.length - prev.phases.length;
    parts.push(
      diff > 0
        ? `${diff} ${diff === 1 ? 'phase' : 'phases'} will be removed`
        : `${-diff} ${-diff === 1 ? 'phase' : 'phases'} will be restored`,
    );
  }

  if (current.currentPhaseId !== prev.currentPhaseId) {
    const curLabel = phaseLabel(current, current.currentPhaseId);
    const prevLabel = phaseLabel(prev, prev.currentPhaseId);
    parts.push(`current phase: ${curLabel} → ${prevLabel}`);
  }

  const statusChanges = collectStatusChanges(current, prev);
  for (const c of statusChanges) {
    parts.push(c);
  }

  return parts.length > 0 ? parts.join('; ') : 'minor state changes';
}

function phaseLabel(state: ProjectState, id: number | null): string {
  if (id === null) {
    return '(none)';
  }
  const p = state.phases.find((x) => x.id === id);
  return p ? `${id} (${p.title})` : `${id} (unknown)`;
}

function collectStatusChanges(current: ProjectState, prev: ProjectState): string[] {
  const out: string[] = [];
  for (const cp of current.phases) {
    const pp = prev.phases.find((x) => x.id === cp.id);
    if (!pp) {
      continue;
    }
    if (pp.status !== cp.status) {
      out.push(`phase ${cp.id}: ${cp.status} → ${pp.status}`);
    }
    if (cp.steps && pp.steps) {
      for (let i = 0; i < cp.steps.length; i++) {
        const cs = cp.steps[i];
        const ps = pp.steps[i];
        if (cs && ps && cs.title === ps.title && cs.status !== ps.status) {
          out.push(`step "${cs.title}": ${cs.status} → ${ps.status}`);
        }
      }
    }
  }
  return out;
}
