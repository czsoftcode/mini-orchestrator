import {
  type Finding,
  type FindingSeverity,
  type FindingSource,
  type FindingStatus,
  FINDING_SEVERITIES,
  FINDING_SOURCES,
  addFinding,
  findFindingById,
  findingsPath,
  isFindingSeverity,
  isFindingSource,
  listFindings,
  reopenFinding,
  resolveFinding,
} from '../state/findingsStore.js';
import { headSha, isGitRepo } from '../git.js';
import { exists, loadHeader } from '../state/store.js';
import type { StateHeader } from '../state/types.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

/**
 * `mini findings` — the durable store of adversarial review findings
 * (`.mini/findings/`). Non-interactive and TTY-free, so it works the same from a
 * terminal and from the Claude Code session that runs a review:
 *
 * - `mini findings add --severity <s> --title <t> [--source <src>] [--where <w>]
 *   [--body <b>]` records one finding about the phase under review (the reviewer
 *   calls this instead of editing the run report); `--source` (`adversarial` |
 *   `verify`) tags which review step found it and defaults to `adversarial`,
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
  source?: string;
  title?: string;
  where?: string;
  /** Phase range the review covered, e.g. `172-178` — recorded by a range review. */
  range?: string;
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

  // `--source` is optional; validate it only when given, and default to
  // `adversarial` (the store's original sole writer) when absent — so the
  // unchanged adversarial prompt and old files stay correct.
  const sourceRaw = opts.source?.trim();
  let source: FindingSource | undefined;
  if (sourceRaw) {
    if (!isFindingSource(sourceRaw)) {
      log.error(`--source must be one of: ${FINDING_SOURCES.join(' | ')} (got "${sourceRaw}").`);
      return { ok: false, reason: 'bad-source' };
    }
    source = sourceRaw;
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

  const input: {
    severity: FindingSeverity;
    source?: FindingSource;
    title: string;
    where?: string;
    reviewedAt?: string;
    range?: string;
    body?: string;
  } = {
    severity,
    title,
  };
  if (source) input.source = source;
  if (opts.where?.trim()) input.where = opts.where.trim();
  if (opts.range?.trim()) input.range = opts.range.trim();
  if (opts.body?.trim()) input.body = opts.body.trim();

  // Stamp the baseline commit the review was performed against. The review runs
  // between `do` and `done`, so HEAD is the phase's parent commit (the reviewed
  // code is still uncommitted) — recorded honestly as "what the review started
  // from", not the reviewed commit. Check `isGitRepo` first: `headSha` is only
  // meaningful inside a repo, and outside git (or a fresh repo with no HEAD) the
  // field is simply omitted, never an error.
  if (await isGitRepo(cwd)) {
    const sha = await headSha(cwd);
    if (sha) input.reviewedAt = sha;
  }

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

/**
 * Shared core of `mini findings resolve`/`reopen`. Flips one or more findings to
 * `target` and prints a distinct line per id, because the store functions return
 * a bare boolean that conflates "no such finding" with "already in that status" —
 * useless for a human-facing command. So each id is looked up first:
 *
 * - id not present (or malformed, e.g. `155` without the `-n` suffix) → an error
 *   line; the batch's exit code becomes non-zero,
 * - finding already in `target` → a benign info line (idempotent, still success),
 * - otherwise → flip via `flip` and confirm.
 *
 * Every id is processed even when an earlier one failed (no stop-on-first-bad),
 * so a mixed batch reports every result. Returns `ok: false` only when at least
 * one id was not found / malformed.
 */
async function findingsSetStatus(
  ids: string[],
  target: FindingStatus,
  flip: (cwd: string, id: string) => Promise<boolean>,
): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const cleaned = ids.map((id) => id.trim()).filter((id) => id.length > 0);
  if (cleaned.length === 0) {
    log.error('Provide at least one finding id, e.g. mini findings resolve 160-1.');
    return { ok: false, reason: 'no-id' };
  }

  // Past-tense verb for the confirmation and the "already" wording, derived from
  // the target so the two wrappers share one message set.
  const done = target === 'resolved' ? 'resolved' : 'reopened';
  const already = target === 'resolved' ? 'already resolved' : 'already open';

  let anyMissing = false;
  for (const id of cleaned) {
    const finding = await findFindingById(cwd, id);
    if (!finding) {
      log.error(`No such finding: ${id}`);
      anyMissing = true;
      continue;
    }
    if (finding.status === target) {
      log.info(`Finding ${id} is ${already}.`);
      continue;
    }
    // The pre-check above already ruled out the no-op cases, so a `false` here
    // means the write itself failed — surface it rather than swallowing it.
    if (await flip(cwd, id)) {
      log.success(`Finding ${id} ${done}.`);
    } else {
      log.error(`Could not update finding ${id} (write failed).`);
      anyMissing = true;
    }
  }

  return anyMissing ? { ok: false, reason: 'not-found' } : { ok: true };
}

/**
 * `mini findings resolve <id...>` — marks one or more findings as resolved,
 * independent of any phase link. Idempotent on an already-resolved id. An optional
 * `reason` records why they were closed and is applied to every id in the batch
 * (only on the open→resolved flip; an already-resolved id keeps its earlier reason).
 */
export function findingsResolve(ids: string[], reason?: string): Promise<StepOutcome> {
  return findingsSetStatus(ids, 'resolved', (cwd, id) => resolveFinding(cwd, id, reason));
}

/**
 * `mini findings reopen <id...>` — flips one or more resolved findings back to
 * open. Idempotent on an already-open id. `--reason` is rejected: a reopened
 * finding has no closing reason, so passing one is a usage error, not a silent
 * no-op.
 */
export function findingsReopen(ids: string[], reason?: string): Promise<StepOutcome> {
  if (reason !== undefined) {
    log.error('--reason applies only to "resolve", not "reopen".');
    return Promise.resolve({ ok: false, reason: 'reason-not-allowed' });
  }
  return findingsSetStatus(ids, 'open', reopenFinding);
}

/** One line per finding: `id [severity] <source> (status) where @sha {range} — title`. */
function renderFinding(f: Finding, showStatus: boolean): string {
  const parts = [f.id, `[${f.severity}]`, f.rawSource ?? f.source];
  if (showStatus) parts.push(`(${f.status})`);
  if (f.where) parts.push(f.where);
  // Short baseline SHA, so a reader can tell which code state the review started
  // from without the full 40-char hash cluttering the line.
  if (f.reviewedAt) parts.push(`@${f.reviewedAt.slice(0, 7)}`);
  // The reviewed range (range reviews only), so the scope is visible at a glance.
  if (f.range) parts.push(`{${f.range}}`);
  parts.push(`— ${f.title}`);
  return `  ${parts.join(' ')}`;
}
