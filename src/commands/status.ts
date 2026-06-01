import pc from 'picocolors';
import { MODEL_SCOPES } from '../state/models.js';
import {
  readRunReportSummary,
  type RunReportSummary,
  type RunReportVerifyItem,
  type RunVerdict,
} from '../state/runReport.js';
import { exists, load, readProject } from '../state/store.js';
import { readTodos } from '../state/todoStore.js';
import type { Phase, PhaseStatus, ProjectState, StepStatus } from '../state/types.js';
import { log } from '../ui/log.js';

const PHASE_LABELS: Record<PhaseStatus, { label: string; color: (s: string) => string }> = {
  done: { label: '[done]', color: pc.green },
  doing: { label: '[doing]', color: pc.yellow },
  planned: { label: '[planned]', color: pc.cyan },
  proposed: { label: '[proposed]', color: pc.dim },
  skipped: { label: '[skipped]', color: pc.dim },
};

const VERDICT_LABELS: Record<RunVerdict, { label: string; color: (s: string) => string }> = {
  done: { label: 'done', color: pc.green },
  partial: { label: 'partial', color: pc.yellow },
  blocked: { label: 'blocked', color: pc.red },
};

const STEP_LABELS: Record<StepStatus, { label: string; color: (s: string) => string }> = {
  done: { label: '[done]', color: pc.green },
  doing: { label: '[doing]', color: pc.yellow },
  todo: { label: '[todo]', color: pc.dim },
  skipped: { label: '[skipped]', color: pc.dim },
};

const STATUS_WIDTH = 10;

export async function status(): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('There is no project in this directory.');
    log.hint('Start with: mini init');
    return;
  }

  const [projectMd, state, todos] = await Promise.all([
    readProject(cwd),
    load(cwd),
    readTodos(cwd),
  ]);

  const titleMatch = projectMd.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? '(untitled)';

  console.log();
  console.log(pc.bold(title));

  // Match both the new English heading and the old Czech one (existing projects
  // still have a Czech project.md — keep showing their "what" line).
  const whatMatch = projectMd.match(/##\s+(?:What I'm building|Co stavím)\s*\n+([^\n]+)/);
  if (whatMatch?.[1]) {
    log.dim(`  ${whatMatch[1].trim()}`);
  }
  const modelLine = describeModels(state);
  if (modelLine) {
    log.dim(`  Models: ${modelLine}`);
  }
  const ideas = ideasSummaryLine(todos.filter((t) => !t.done).length);
  if (ideas) {
    log.dim(`  ${ideas}`);
  }

  console.log();

  if (state.phases.length === 0) {
    log.dim('No phases.');
    log.hint('Next: mini next');
    return;
  }

  // We read the run report only for the current phase — only there does it make
  // sense to show how the last auto session went and what is pending verification.
  let currentSummary: RunReportSummary | null = null;
  const current = state.phases.find((p) => p.id === state.currentPhaseId);
  if (current) {
    currentSummary = await readRunReportSummary(cwd, current.id);
  }

  console.log(pc.bold('Phases:'));
  for (const phase of state.phases) {
    const isCurrent = phase.id === state.currentPhaseId;
    printPhase(phase, isCurrent, state, isCurrent ? currentSummary : null);
  }

  console.log();
  log.hint(nextActionHint(state));
}

function printPhase(
  p: Phase,
  isCurrent: boolean,
  state: ProjectState,
  summary: RunReportSummary | null,
): void {
  const status = renderStatus(PHASE_LABELS[p.status]);
  const marker = isCurrent ? pc.cyan('>') : ' ';
  const title = isCurrent ? pc.bold(p.title) : p.title;
  console.log(`  ${status} ${marker} ${p.id}. ${title}`);

  if (p.humanNotes) {
    console.log(pc.dim(`              ${p.humanNotes}`));
  }

  // An orphaned doing phase (stuck in "doing" with no open work) — a human
  // would otherwise easily miss it in the list. We highlight it in yellow with a hint.
  if (isOrphanedDoing(p, state.phases)) {
    console.log(`              ${pc.yellow('⚠ stuck:')} ${pc.yellow(orphanedDoingNote(p, state.phases))}`);
  }

  if (isCurrent && p.steps?.length) {
    for (const step of p.steps) {
      const sStatus = renderStatus(STEP_LABELS[step.status]);
      console.log(`              ${sStatus} ${step.title}`);
    }
  }

  if (isCurrent && summary) {
    for (const line of runReportSummaryLines(summary, p)) {
      console.log(`              ${line}`);
    }
  }
}

function renderStatus(entry: { label: string; color: (s: string) => string }): string {
  return entry.color(entry.label.padEnd(STATUS_WIDTH));
}

/**
 * Header line about the ideas archive (`mini todo`). Shown only when there is at
 * least one open item, so an empty archive adds no noise. The hint points at the
 * command that lists them.
 */
export function ideasSummaryLine(openCount: number): string | null {
  if (openCount <= 0) return null;
  return `Ideas: ${openCount} open (mini todo)`;
}

export function describeModels(state: ProjectState): string {
  const parts: string[] = [];
  for (const scope of MODEL_SCOPES) {
    const value = state.models?.[scope];
    if (value) {
      parts.push(`${scope}=${value}`);
    }
  }
  return parts.join(', ');
}

/**
 * Number of items for manual verification that no one has handled yet. Items
 * resolved by an earlier `mini done` (`phase.resolvedVerify`) are not counted.
 */
export function openVerifyCount(verify: readonly RunReportVerifyItem[], phase: Phase): number {
  const resolved = new Set(phase.resolvedVerify ?? []);
  return verify.filter((v) => !resolved.has(v.title)).length;
}

function pluralVerify(n: number): string {
  return n === 1 ? 'item' : 'items';
}

/**
 * Lines with the run report summary under the current phase: the verdict of the
 * last auto session and how many items for manual verification are still pending.
 * Picocolors colors turn off automatically outside a TTY, so the output is plain
 * text in tests.
 */
export function runReportSummaryLines(summary: RunReportSummary, phase: Phase): string[] {
  if (summary.unparseable) {
    return [pc.dim('run report: exists but cannot be read (corrupted YAML?)')];
  }

  const verdictPart = summary.verdict
    ? `verdict ${VERDICT_LABELS[summary.verdict].color(VERDICT_LABELS[summary.verdict].label)}`
    : 'verdict unknown';

  const open = openVerifyCount(summary.verify, phase);
  let verifyPart: string;
  if (open > 0) {
    verifyPart = pc.yellow(`${open} ${pluralVerify(open)} pending verification`);
  } else if (summary.verify.length > 0) {
    verifyPart = 'all verified';
  } else {
    verifyPart = 'no items to verify';
  }

  return [pc.dim(`run report: ${verdictPart} · ${verifyPart}`)];
}

/**
 * Is the phase an orphaned `doing` — stuck in "doing" with no open work left?
 * Two cases:
 * - it has subphases and all are closed (`done`/`skipped`) — nobody closed the
 *   parent after a fix subphase (see W1),
 * - it has steps and all are closed — the auto session finished, but `mini done`
 *   has not closed the phase yet.
 * A phase with no steps and no subphases (freshly started) is not orphaned.
 */
export function isOrphanedDoing(phase: Phase, phases: readonly Phase[]): boolean {
  if (phase.status !== 'doing') return false;

  const subs = phases.filter((p) => p.id !== phase.id && Math.floor(p.id) === phase.id);
  if (subs.length > 0) {
    return subs.every((s) => s.status === 'done' || s.status === 'skipped');
  }

  const steps = phase.steps ?? [];
  if (steps.length === 0) return false;
  return steps.every((s) => s.status === 'done' || s.status === 'skipped');
}

function orphanedDoingNote(phase: Phase, phases: readonly Phase[]): string {
  const subs = phases.filter((p) => p.id !== phase.id && Math.floor(p.id) === phase.id);
  if (subs.length > 0) {
    return 'phase "doing", but all its subphases are closed — close it via mini done';
  }
  return 'phase "doing", but it has no open steps — close it via mini done';
}

export function nextActionHint(state: ProjectState): string {
  if (state.currentPhaseId === null) {
    return 'Next: mini next (proposes the first phase)';
  }
  const current = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!current) {
    return 'Next: mini next';
  }
  switch (current.status) {
    case 'proposed':
      return 'Next: mini plan (break it down) or mini do (run directly)';
    case 'planned':
    case 'doing':
      return 'Next: mini do (continue) | mini done (mark as done)';
    case 'done':
      return 'Next: mini next (propose the next phase)';
    case 'skipped':
      return 'Next: mini next';
  }
}
