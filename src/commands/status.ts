import pc from 'picocolors';
import { MODEL_SCOPES } from '../state/models.js';
import {
  readRunReportSummary,
  type RunReportSummary,
  type RunReportVerifyItem,
  type RunVerdict,
} from '../state/runReport.js';
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

const VERDICT_LABELS: Record<RunVerdict, { label: string; color: (s: string) => string }> = {
  done: { label: 'hotovo', color: pc.green },
  partial: { label: 'částečně', color: pc.yellow },
  blocked: { label: 'zablokováno', color: pc.red },
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

  // Run report čteme jen pro aktuální fázi — jen u ní má smysl ukazovat, jak
  // dopadla poslední auto session a co čeká na ruční ověření.
  let currentSummary: RunReportSummary | null = null;
  const current = state.phases.find((p) => p.id === state.currentPhaseId);
  if (current) {
    currentSummary = await readRunReportSummary(cwd, current.id);
  }

  console.log(pc.bold('Fáze:'));
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

  // Osiřelá doing fáze (uvázla ve stavu „dělá se" bez otevřené práce) — člověk
  // ji jinak v seznamu snadno přehlédne. Žlutě ji odlišíme i s návodem.
  if (isOrphanedDoing(p, state.phases)) {
    console.log(`              ${pc.yellow('⚠ uvázlo:')} ${pc.yellow(orphanedDoingNote(p, state.phases))}`);
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
 * Počet bodů k ručnímu ověření, které ještě nikdo neodbavil. Body vyřešené
 * dřívějším `mini done` (`phase.resolvedVerify`) se nepočítají.
 */
export function openVerifyCount(verify: readonly RunReportVerifyItem[], phase: Phase): number {
  const resolved = new Set(phase.resolvedVerify ?? []);
  return verify.filter((v) => !resolved.has(v.title)).length;
}

function pluralVerify(n: number): string {
  if (n === 1) return 'bod';
  if (n >= 2 && n <= 4) return 'body';
  return 'bodů';
}

/**
 * Řádky se souhrnem run reportu pod aktuální fází: verdikt poslední auto
 * session a kolik bodů k ručnímu ověření ještě čeká. Picocolors barvy se mimo
 * TTY automaticky vypnou, takže výstup je v testech čistý text.
 */
export function runReportSummaryLines(summary: RunReportSummary, phase: Phase): string[] {
  if (summary.unparseable) {
    return [pc.dim('run report: existuje, ale nejde přečíst (poškozený YAML?)')];
  }

  const verdictPart = summary.verdict
    ? `verdikt ${VERDICT_LABELS[summary.verdict].color(VERDICT_LABELS[summary.verdict].label)}`
    : 'verdikt neznámý';

  const open = openVerifyCount(summary.verify, phase);
  let verifyPart: string;
  if (open > 0) {
    verifyPart = pc.yellow(`${open} ${pluralVerify(open)} k ověření čeká`);
  } else if (summary.verify.length > 0) {
    verifyPart = 'vše ověřeno';
  } else {
    verifyPart = 'bez bodů k ověření';
  }

  return [pc.dim(`run report: ${verdictPart} · ${verifyPart}`)];
}

/**
 * Je fáze osiřelá `doing` — uvázlá ve stavu „dělá se", aniž by zbývala
 * otevřená práce? Dva případy:
 * - má podfáze a všechny jsou uzavřené (`done`/`skipped`) — rodič po opravné
 *   podfázi nikdo nedozavřel (viz W1),
 * - má kroky a všechny jsou uzavřené — auto session doběhla, ale `mini done`
 *   fázi ještě nezavřel.
 * Fáze bez kroků i bez podfází (čerstvě spuštěná) osiřelá není.
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
    return 'fáze „dělá se", ale všechny její podfáze jsou uzavřené — zavři ji přes mini done';
  }
  return 'fáze „dělá se", ale nemá otevřené kroky — zavři ji přes mini done';
}

export function nextActionHint(state: ProjectState): string {
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
