import pc from 'picocolors';
import { MODEL_SCOPES } from '../state/models.js';
import { exists, load, readProject } from '../state/store.js';
import type { Phase, PhaseStatus, ProjectState, StepStatus } from '../state/types.js';
import { log } from '../ui/log.js';

const PHASE_LABELS: Record<PhaseStatus, { label: string; color: (s: string) => string }> = {
  done: { label: '[hotovo]', color: pc.green },
  doing: { label: '[dělá se]', color: pc.yellow },
  planned: { label: '[plán]', color: pc.cyan },
  proposed: { label: '[návrh]', color: pc.dim },
  skipped: { label: '[odlož.]', color: pc.dim },
};

const STEP_LABELS: Record<StepStatus, { label: string; color: (s: string) => string }> = {
  done: { label: '[hotovo]', color: pc.green },
  doing: { label: '[dělá se]', color: pc.yellow },
  todo: { label: '[čeká]', color: pc.dim },
  skipped: { label: '[odlož.]', color: pc.dim },
};

const STATUS_WIDTH = 10;

export async function status(): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni příkazem: mini init');
    return;
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

  const titleMatch = projectMd.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? '(bez názvu)';

  console.log();
  console.log(pc.bold(title));

  const whatMatch = projectMd.match(/##\s+Co stavím\s*\n+([^\n]+)/);
  if (whatMatch?.[1]) {
    log.dim(`  ${whatMatch[1].trim()}`);
  }
  const modelLine = describeModels(state);
  if (modelLine) {
    log.dim(`  Modely: ${modelLine}`);
  }

  console.log();

  if (state.phases.length === 0) {
    log.dim('Žádné fáze.');
    log.hint('Další: mini next');
    return;
  }

  console.log(pc.bold('Fáze:'));
  for (const phase of state.phases) {
    printPhase(phase, phase.id === state.currentPhaseId);
  }

  console.log();
  log.hint(nextActionHint(state));
}

function printPhase(p: Phase, isCurrent: boolean): void {
  const status = renderStatus(PHASE_LABELS[p.status]);
  const marker = isCurrent ? pc.cyan('>') : ' ';
  const title = isCurrent ? pc.bold(p.title) : p.title;
  console.log(`  ${status} ${marker} ${p.id}. ${title}`);

  if (p.humanNotes) {
    console.log(pc.dim(`              ${p.humanNotes}`));
  }

  if (isCurrent && p.steps?.length) {
    for (const step of p.steps) {
      const sStatus = renderStatus(STEP_LABELS[step.status]);
      console.log(`              ${sStatus} ${step.title}`);
    }
  }
}

function renderStatus(entry: { label: string; color: (s: string) => string }): string {
  return entry.color(entry.label.padEnd(STATUS_WIDTH));
}

function describeModels(state: ProjectState): string {
  const parts: string[] = [];
  for (const scope of MODEL_SCOPES) {
    const value = state.models?.[scope] ?? (scope === 'default' ? state.model : undefined);
    if (value) {
      parts.push(`${scope}=${value}`);
    }
  }
  return parts.join(', ');
}

function nextActionHint(state: ProjectState): string {
  if (state.currentPhaseId === null) {
    return 'Další: mini next (navrhne první fázi)';
  }
  const current = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!current) {
    return 'Další: mini next';
  }
  switch (current.status) {
    case 'proposed':
      return 'Další: mini plan (rozmenit) nebo mini do (spustit přímo)';
    case 'planned':
    case 'doing':
      return 'Další: mini do (pokračovat) | mini done (označit hotové)';
    case 'done':
      return 'Další: mini next (navrhnout další fázi)';
    case 'skipped':
      return 'Další: mini next';
  }
}
