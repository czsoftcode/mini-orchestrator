import pc from 'picocolors';
import { readDecision } from '../state/decisionStore.js';
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

export interface StatusOptions {
  /** Print a machine-readable JSON object instead of the human overview. */
  json?: boolean;
  /** Show the detail of a single phase (by id) instead of the whole overview. */
  phase?: number;
}

export async function status(opts: StatusOptions = {}): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    if (opts.json) {
      console.log(JSON.stringify({ error: 'no-project' }));
      return;
    }
    log.warn('There is no project in this directory.');
    log.hint('Start with: mini init');
    return;
  }

  const [projectMd, state, todos] = await Promise.all([
    readProject(cwd),
    load(cwd),
    readTodos(cwd),
  ]);

  const openTodos = todos.filter((t) => !t.done).length;

  if (opts.phase !== undefined) {
    await showPhaseDetail(state, opts.phase, cwd, opts.json ?? false);
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(buildStatusJson(projectMd, state, openTodos), null, 2));
    return;
  }

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
  const ideas = ideasSummaryLine(openTodos);
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

/**
 * `mini status --phase <n>` — detail of a single phase. Reads the phase's run
 * report (tolerantly — never crashes on a stale report) and prints either the
 * human detail view or, with `--json`, a machine-readable object. An unknown id
 * fails cleanly (warning + exit code 1 / a JSON error object).
 */
async function showPhaseDetail(
  state: ProjectState,
  phaseId: number,
  cwd: string,
  json: boolean,
): Promise<void> {
  const phase = state.phases.find((p) => p.id === phaseId);
  if (!phase) {
    if (json) {
      console.log(JSON.stringify({ error: 'no-such-phase', phase: phaseId }));
    } else {
      log.warn(`There is no phase ${phaseId} in this project.`);
      log.hint('List the phases with: mini status');
    }
    process.exitCode = 1;
    return;
  }

  const summary = await readRunReportSummary(cwd, phase.id);
  const decision = await readDecision(cwd, phase.id);

  const isCurrent = phase.id === state.currentPhaseId;
  if (json) {
    console.log(JSON.stringify(buildPhaseDetailJson(phase, summary, isCurrent, decision), null, 2));
    return;
  }

  console.log();
  for (const line of renderPhaseDetail(phase, summary, isCurrent, decision)) {
    console.log(line);
  }
  console.log();
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
  const ms = phaseDuration(p);
  const took = ms !== null ? ` ${pc.dim(`(took ${formatDuration(ms)})`)}` : '';
  console.log(`  ${status} ${marker} ${p.id}. ${title}${took}`);

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

/**
 * Compact human duration: the two largest non-zero units (e.g. `45s`, `3m`,
 * `2h 5m`, `1d 2h`). Sub-second or negative inputs render as `0s`.
 */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const units: Array<[number, string]> = [
    [Math.floor(totalSec / 86400), 'd'],
    [Math.floor((totalSec % 86400) / 3600), 'h'],
    [Math.floor((totalSec % 3600) / 60), 'm'],
    [totalSec % 60, 's'],
  ];
  const nonzero = units.filter(([v]) => v > 0);
  if (nonzero.length === 0) return '0s';
  return nonzero
    .slice(0, 2)
    .map(([v, u]) => `${v}${u}`)
    .join(' ');
}

/** How long a phase took, in ms, from `startedAt`..`completedAt`; `null` when not both present (or invalid). */
export function phaseDuration(phase: Phase): number | null {
  if (!phase.startedAt || !phase.completedAt) return null;
  const start = Date.parse(phase.startedAt);
  const end = Date.parse(phase.completedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return end - start;
}

export interface StatusJsonStep {
  title: string;
  status: StepStatus;
}

export interface StatusJsonPhase {
  id: number;
  title: string;
  status: PhaseStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  steps: StatusJsonStep[];
}

export interface StatusJson {
  title: string;
  what: string | null;
  models: Record<string, string>;
  currentPhaseId: number | null;
  ideasOpen: number;
  phases: StatusJsonPhase[];
}

/** A single step in the phase-detail JSON — includes the planning `detail`. */
export interface PhaseDetailJsonStep {
  title: string;
  status: StepStatus;
  detail?: string;
}

/** Machine-readable run report for the phase-detail JSON. */
export interface PhaseDetailJsonRunReport {
  verdict: RunVerdict | null;
  unparseable: boolean;
  verify: RunReportVerifyItem[];
  body?: string;
}

/** `mini status --phase <n> --json` — detail of one phase with its run report. */
export interface PhaseDetailJson {
  id: number;
  title: string;
  goal: string | null;
  status: PhaseStatus;
  isCurrent: boolean;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  steps: PhaseDetailJsonStep[];
  /** Raw markdown of the phase's ADR (`.mini/decisions/phase-{id}.md`), or `null` when absent. */
  decision: string | null;
  runReport: PhaseDetailJsonRunReport | null;
}

/** Builds the machine-readable detail of a single phase (`mini status --phase <n> --json`). Pure. */
export function buildPhaseDetailJson(
  phase: Phase,
  summary: RunReportSummary | null,
  isCurrent = false,
  decision: string | null = null,
): PhaseDetailJson {
  const out: PhaseDetailJson = {
    id: phase.id,
    title: phase.title,
    goal: phase.goal ?? null,
    status: phase.status,
    isCurrent,
    steps: (phase.steps ?? []).map((s) => {
      const step: PhaseDetailJsonStep = { title: s.title, status: s.status };
      if (s.detail) step.detail = s.detail;
      return step;
    }),
    decision,
    runReport: null,
  };
  if (phase.startedAt) out.startedAt = phase.startedAt;
  if (phase.completedAt) out.completedAt = phase.completedAt;
  const dur = phaseDuration(phase);
  if (dur !== null) out.durationMs = dur;
  if (summary) {
    const rr: PhaseDetailJsonRunReport = {
      verdict: summary.verdict,
      unparseable: summary.unparseable,
      verify: summary.verify,
    };
    if (summary.body) rr.body = summary.body;
    out.runReport = rr;
  }
  return out;
}

/** Builds the machine-readable status object (`mini status --json`). Pure. */
export function buildStatusJson(
  projectMd: string,
  state: ProjectState,
  openTodos: number,
): StatusJson {
  const title = projectMd.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '(untitled)';
  const what =
    projectMd.match(/##\s+(?:What I'm building|Co stavím)\s*\n+([^\n]+)/)?.[1]?.trim() ?? null;

  const models: Record<string, string> = {};
  for (const scope of MODEL_SCOPES) {
    const value = state.models?.[scope];
    if (value) models[scope] = value;
  }

  const phases: StatusJsonPhase[] = state.phases.map((p) => {
    const out: StatusJsonPhase = {
      id: p.id,
      title: p.title,
      status: p.status,
      steps: (p.steps ?? []).map((s) => ({ title: s.title, status: s.status })),
    };
    if (p.startedAt) out.startedAt = p.startedAt;
    if (p.completedAt) out.completedAt = p.completedAt;
    const dur = phaseDuration(p);
    if (dur !== null) out.durationMs = dur;
    return out;
  });

  return { title, what, models, currentPhaseId: state.currentPhaseId, ideasOpen: openTodos, phases };
}

/**
 * Detailed view of a single phase (`mini status --phase <n>`). Pure: returns the
 * lines to print, so it is testable without a TTY. Picocolors disables colors
 * outside a TTY, so the output is plain text in tests. Shows the phase header
 * (status, title, goal, duration), every step with its `detail`, and — when a
 * run report exists — the verdict, items for manual verification and the
 * free-text body.
 */
export function renderPhaseDetail(
  phase: Phase,
  summary: RunReportSummary | null,
  isCurrent: boolean,
  decision: string | null = null,
): string[] {
  const lines: string[] = [];

  const status = renderStatus(PHASE_LABELS[phase.status]);
  const marker = isCurrent ? pc.cyan('>') : ' ';
  const ms = phaseDuration(phase);
  const took = ms !== null ? ` ${pc.dim(`(took ${formatDuration(ms)})`)}` : '';
  lines.push(`${status} ${marker} ${phase.id}. ${pc.bold(phase.title)}${took}`);

  if (phase.goal) {
    lines.push(pc.dim(`  Goal: ${phase.goal}`));
  }
  if (phase.humanNotes) {
    lines.push(pc.dim(`  Notes: ${phase.humanNotes}`));
  }

  lines.push('');
  const steps = phase.steps ?? [];
  if (steps.length === 0) {
    lines.push(pc.dim('  No steps.'));
  } else {
    lines.push(pc.bold('  Steps:'));
    for (const step of steps) {
      const sStatus = renderStatus(STEP_LABELS[step.status]);
      lines.push(`    ${sStatus} ${step.title}`);
      if (step.detail) {
        lines.push(pc.dim(`               ${step.detail}`));
      }
    }
  }

  if (decision) {
    lines.push('');
    lines.push(pc.bold('  Decision:'));
    for (const line of decision.split('\n')) {
      lines.push(line ? `    ${line}` : '');
    }
  }

  if (summary) {
    lines.push('');
    lines.push(pc.bold('  Run report:'));
    for (const line of runReportSummaryLines(summary, phase)) {
      lines.push(`    ${line}`);
    }
    if (summary.body) {
      lines.push('');
      for (const line of summary.body.split('\n')) {
        lines.push(line ? `    ${line}` : '');
      }
    }
  }

  return lines;
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
