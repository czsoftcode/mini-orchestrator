import {
  type Finding,
  type FindingSeverity,
  FINDING_SEVERITIES,
  addFinding,
  findingsPath,
  isFindingSeverity,
  listFindings,
} from '../state/findingsStore.js';
import { exists, loadHeader } from '../state/store.js';
import type { StateHeader } from '../state/types.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

/**
 * `mini findings` — the durable store of adversarial review findings
 * (`.mini/findings/`). Non-interactive and TTY-free, so it works the same from a
 * terminal and from the Claude Code session that runs a review:
 *
 * - `mini findings add --severity <s> --title <t> [--where <w>] [--body <b>]`
 *   records one finding about the phase under review (the reviewer calls this
 *   instead of editing the run report),
 * - `mini findings list [--all]` prints the open findings across all phases
 *   (`--all` includes resolved ones).
 *
 * Origin phase is **inferred by mini**, never passed by the model: the current
 * phase, else the last closed one — the same selection the adversarial prompt is
 * built for. Recording, not modifying code, is the whole point, so `add` only
 * ever touches `.mini/findings/`.
 */

/** The phase a review (and thus a finding) is about: current, else the last `done`. */
function reviewPhaseId(header: StateHeader): number | null {
  if (header.currentPhaseId !== null) return header.currentPhaseId;
  const lastDone = [...header.phases].reverse().find((p) => p.status === 'done');
  return lastDone ? lastDone.id : null;
}

export interface FindingsAddOptions {
  severity?: string;
  title?: string;
  where?: string;
  body?: string;
}

/**
 * `mini findings add` — records one finding about the phase under review and
 * prints a confirmation (the assigned id + the file path), so a failed call is
 * visible rather than silently swallowed.
 */
export async function findingsAdd(opts: FindingsAddOptions): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const severity = opts.severity?.trim();
  if (!severity || !isFindingSeverity(severity)) {
    log.error(
      `--severity must be one of: ${FINDING_SEVERITIES.join(' | ')}` +
        (severity ? ` (got "${severity}").` : '.'),
    );
    return { ok: false, reason: 'bad-severity' };
  }

  const title = opts.title?.trim();
  if (!title) {
    log.error('--title is required (a short headline of the finding).');
    return { ok: false, reason: 'no-title' };
  }

  const header = await loadHeader(cwd);
  const phaseId = reviewPhaseId(header);
  if (phaseId === null) {
    log.error('No phase to attach the finding to (neither a current nor a closed phase).');
    log.hint('Findings are recorded against the phase under review — run a phase first.');
    return { ok: false, reason: 'no-phase' };
  }

  const input: { severity: FindingSeverity; title: string; where?: string; body?: string } = {
    severity,
    title,
  };
  if (opts.where?.trim()) input.where = opts.where.trim();
  if (opts.body?.trim()) input.body = opts.body.trim();

  const { id } = await addFinding(cwd, phaseId, input);
  const rel = findingsPath('', phaseId).replace(/^[/\\]/, '');
  log.success(`Finding ${id} recorded [${severity}] → ${rel}`);
  return { ok: true };
}

export interface FindingsListOptions {
  all?: boolean;
}

/**
 * `mini findings list` — prints open findings across all phases (read-only).
 * `--all` includes resolved ones. An empty or missing store prints a friendly
 * note and never errors.
 */
export async function findingsList(opts: FindingsListOptions): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const findings = await listFindings(cwd, { includeResolved: opts.all });
  if (findings.length === 0) {
    log.info(opts.all ? 'No findings recorded.' : 'No open findings.');
    return { ok: true };
  }

  log.title(opts.all ? 'Findings (all)' : 'Open findings');
  for (const f of findings) {
    log.info(renderFinding(f, !!opts.all));
  }
  return { ok: true };
}

/** One line per finding: `id [severity] (status) where — title`. */
function renderFinding(f: Finding, showStatus: boolean): string {
  const parts = [f.id, `[${f.severity}]`];
  if (showStatus) parts.push(`(${f.status})`);
  if (f.where) parts.push(f.where);
  parts.push(`— ${f.title}`);
  return `  ${parts.join(' ')}`;
}
