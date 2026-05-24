import { commitAll, hasChanges, headSha, isGitRepo } from '../git.js';
import {
  RunReportParseError,
  readRunReport,
  runReportPath,
  type RunReport,
} from '../state/runReport.js';
import { exists, load, save } from '../state/store.js';
import type { Phase, ProjectState, Step } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import type { AutoOptions, StepOutcome } from './types.js';

export async function done(opts: AutoOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const state = await load(cwd);

  if (state.currentPhaseId === null) {
    log.warn('Žádná aktuální fáze.');
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('Stav je nekonzistentní (currentPhaseId odkazuje na neexistující fázi).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done') {
    log.info(`Fáze ${phase.id} (${phase.title}) už je hotová.`);
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'phase-done' };
  }

  // V auto módu se stav fáze posouvá podle reportu, který Claude zapsal na
  // konci session. Když report sedí, posuneme statusy a případně finalizujeme.
  // Když chybí nebo je poškozený, sjedeme do interaktivního fallbacku — nikdy
  // neoznačujeme nic naslepo.
  if (opts.auto) {
    const applied = await applyAutoReport(phase, state, cwd);
    if (applied.handled) {
      return applied.outcome;
    }
    opts = { ...opts, auto: false };
  }

  const doingStep = phase.steps?.find((s) => s.status === 'doing') ?? null;
  if (doingStep) {
    const moreStepsAfter = (phase.steps ?? []).some(
      (s) => s !== doingStep && s.status !== 'done' && s.status !== 'skipped',
    );
    await finalizeStep(doingStep, moreStepsAfter, opts);
    await save(state, cwd);
    if (doingStep.status !== 'done' && doingStep.status !== 'skipped') {
      return { ok: true };
    }
    if (moreStepsAfter && !opts.auto) {
      log.hint('Další: mini do (pokračovat dalším krokem)');
      return { ok: true };
    }
    if (moreStepsAfter) {
      // v auto módu: krok je hotový, ale zbývají další kroky — fázi zatím nefinalizujeme
      return { ok: true };
    }
    // krok byl poslední — pokračujeme finalizací fáze
  }

  const remainingSteps = (phase.steps ?? []).filter((s) => s.status !== 'done' && s.status !== 'skipped');
  if (remainingSteps.length > 0) {
    log.info(`Fáze ${phase.id} (${phase.title}) má ${remainingSteps.length} ${remainingSteps.length === 1 ? 'nedokončený krok' : 'nedokončených kroků'}:`);
    for (const s of remainingSteps) {
      log.dim(`  - ${s.title}`);
    }
    console.log();

    if (opts.auto) {
      for (const s of remainingSteps) {
        s.status = 'skipped';
      }
      log.dim(`${remainingSteps.length} kroků označeno jako odložené.`);
      phase.status = 'done';
      phase.completedAt = new Date().toISOString();
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'done', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }

    const { decision } = await ask<'decision'>({
      type: 'select',
      name: 'decision',
      message: 'Co s tím?',
      choices: [
        { title: 'Pracovat na dalším kroku', value: 'continue' },
        { title: 'Označit fázi za hotovou (zbylé kroky → odloženo)', value: 'force-done' },
        { title: 'Odložit fázi (přeskočit celou)', value: 'force-skip' },
        { title: 'Zrušit', value: 'cancel' },
      ],
    });

    if (decision === 'cancel') {
      log.dim('Nic se nemění.');
      return { ok: false, reason: 'cancelled' };
    }
    if (decision === 'continue') {
      log.hint('Spusť: mini do');
      return { ok: true };
    }
    for (const s of remainingSteps) {
      s.status = 'skipped';
    }
    log.dim(`${remainingSteps.length} kroků označeno jako odložené.`);

    if (decision === 'force-skip') {
      phase.status = 'skipped';
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'skip', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }
    if (decision === 'force-done') {
      phase.status = 'done';
      phase.completedAt = new Date().toISOString();
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'done', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }
  }

  return finalizePhase(phase, state, cwd, opts);
}

async function collectNotesAndSave(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  outcome: 'done' | 'skip',
  opts: AutoOptions = {},
): Promise<Phase | null> {
  if (!opts.auto) {
    const { notes } = await ask<'notes'>({
      type: 'text',
      name: 'notes',
      message: 'Krátká poznámka (co se povedlo / co je špatně, můžeš nechat prázdné):',
      initial: '',
    });
    const trimmedNotes = (notes as string).trim();
    if (trimmedNotes) {
      phase.humanNotes = trimmedNotes;
    }
  }
  if (outcome === 'done') {
    log.success(`Fáze ${phase.id} (${phase.title}) hotová.`);
  } else {
    log.warn(`Fáze ${phase.id} odložena.`);
  }
  const next = advanceToNextPhase(state);
  logNextPhase(next);
  if (outcome === 'done') {
    await commitPhaseWork(phase, cwd);
  }
  await save(state, cwd);
  return next;
}

function logNextPhase(next: Phase | null): void {
  if (next) {
    log.hint(`Pokračuje se fází ${next.id}: ${next.title}. Spusť: mini do`);
  } else {
    log.hint('Žádná další fáze v plánu. Spusť: mini next');
  }
}

/**
 * Sestaví commit message pro hotovou fázi. Subject je krátký a jednoznačný,
 * tělo (pokud existuje) přidává `humanNotes`, které uživatel zapsal v `done`.
 * `goal` ze stavu do těla záměrně nedáváme — duplikuje se s `.mini/state.json`.
 */
export function buildPhaseCommitMessage(phase: Phase): string {
  const subject = `Fáze ${phase.id}: ${phase.title}`;
  const body = phase.humanNotes?.trim();
  if (body) {
    return `${subject}\n\n${body}\n`;
  }
  return subject;
}

/**
 * Auto-commit po finalizaci fáze (`phase.status === 'done'`). Nikdy nehází —
 * gitové chyby jenom zalogujeme jako varování, aby přerušený commit nezablokoval
 * `mini done` (uživatel může commitnout ručně). Push záměrně nepouštíme —
 * fáze 11 explicitně říká „push se pak dělá na požádání".
 *
 * Pre-commit HEAD si pamatujeme přímo na `phase.autoCommit`, aby `mini undo`
 * mohl bezpečně udělat soft reset zpět. Volající musí po této funkci ještě
 * uložit state — autoCommit info pak skončí v `state.json`.
 */
async function commitPhaseWork(phase: Phase, cwd: string): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    log.dim('Git repozitář nenalezen — commit přeskočen.');
    return;
  }
  if (!(await hasChanges(cwd))) {
    log.dim('Žádné změny v gitu — commit přeskočen.');
    return;
  }

  const preSha = await headSha(cwd);

  const message = buildPhaseCommitMessage(phase);
  const r = await commitAll(cwd, message);
  if (!r.ok) {
    log.warn('Git commit selhal.');
    const detail = r.stderr.trim() || r.stdout.trim();
    if (detail) log.dim(detail);
    log.hint('Commit můžeš dokončit ručně: git add -A && git commit');
    return;
  }
  const subject = message.split('\n')[0] ?? message;
  log.success(`Commit: ${subject}`);
  log.hint('Pro nahrání na remote spusť: git push');

  const postSha = await headSha(cwd);
  if (preSha && postSha) {
    phase.autoCommit = { preSha, sha: postSha, subject };
  }
}

export function advanceToNextPhase(state: ProjectState): Phase | null {
  const nextPhase =
    state.phases.find(
      (p) => p.id !== state.currentPhaseId && (p.status === 'proposed' || p.status === 'planned'),
    ) ?? null;
  state.currentPhaseId = nextPhase ? nextPhase.id : null;
  return nextPhase;
}

async function finalizeStep(step: Step, moreStepsLeft: boolean, opts: AutoOptions = {}): Promise<void> {
  let outcome: 'done' | 'keep' | 'skip';
  if (opts.auto) {
    outcome = 'done';
  } else {
    const answer = await ask<'outcome'>({
      type: 'select',
      name: 'outcome',
      message: `Krok "${step.title}" — jak to dopadlo?`,
      choices: [
        { title: 'Hotovo, funguje', value: 'done' },
        { title: 'Ještě ne, nech ho doing', value: 'keep' },
        { title: 'Odložit (přeskočit)', value: 'skip' },
      ],
    });
    outcome = answer.outcome as 'done' | 'keep' | 'skip';
  }

  if (outcome === 'keep') {
    log.dim('Krok zůstává jako "dělá se".');
    return;
  }
  if (outcome === 'skip') {
    step.status = 'skipped';
    log.warn(`Krok "${step.title}" odložen.`);
    return;
  }

  step.status = 'done';
  log.success(`Krok "${step.title}" hotov.`);

  if (moreStepsLeft) {
    return;
  }

  log.info('To byl poslední krok fáze.');
}

type AutoApplyResult =
  | { handled: true; outcome: StepOutcome }
  | { handled: false };

async function applyAutoReport(
  phase: Phase,
  state: ProjectState,
  cwd: string,
): Promise<AutoApplyResult> {
  const expectedStepTitles = (phase.steps ?? []).map((s) => s.title);
  const reportFile = runReportPath(cwd, phase.id);

  let report: RunReport | null;
  try {
    report = await readRunReport(cwd, {
      expectedPhaseId: phase.id,
      expectedStepTitles,
    });
  } catch (err) {
    if (err instanceof RunReportParseError) {
      log.warn(`Report fáze ${phase.id} je poškozený: ${err.message}`);
      log.dim(`Soubor: ${reportFile}`);
      log.dim('Přepínám do interaktivního módu — projdeme kroky ručně.');
      return { handled: false };
    }
    throw err;
  }

  if (!report) {
    log.warn(`Report fáze ${phase.id} nenalezen (${reportFile}).`);
    log.dim('Přepínám do interaktivního módu — projdeme kroky ručně.');
    return { handled: false };
  }

  for (const reported of report.steps) {
    const step = phase.steps?.find((s) => s.title === reported.title);
    if (!step) continue;
    if (reported.status === 'done') {
      step.status = 'done';
    } else if (reported.status === 'skipped') {
      step.status = 'skipped';
    } else {
      // `blocked` i `todo` znamenají, že krok není uzavřený — retry pokus
      // ho najde jako `todo` a pošle Claudovi znovu.
      step.status = 'todo';
    }
  }

  const remaining = (phase.steps ?? []).filter(
    (s) => s.status !== 'done' && s.status !== 'skipped',
  );

  if (!phase.steps?.length) {
    if (report.verdict !== 'done') {
      log.warn(`Fáze ${phase.id}: verdict reportu je "${report.verdict}" — fázi nezavírám.`);
      await save(state, cwd);
      return { handled: true, outcome: { ok: true } };
    }
  } else if (remaining.length > 0) {
    log.warn(
      `Fáze ${phase.id}: zbývá ${remaining.length} ${remaining.length === 1 ? 'nedokončený krok' : 'nedokončených kroků'} (verdict: ${report.verdict}).`,
    );
    for (const s of remaining) {
      log.dim(`  - ${s.title}`);
    }
    await save(state, cwd);
    return { handled: true, outcome: { ok: true } };
  }

  phase.status = 'done';
  phase.completedAt = new Date().toISOString();
  log.success(`Fáze ${phase.id} (${phase.title}) hotová.`);
  const nextPhase = advanceToNextPhase(state);
  logNextPhase(nextPhase);
  await commitPhaseWork(phase, cwd);
  await save(state, cwd);
  return {
    handled: true,
    outcome: { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null },
  };
}

async function finalizePhase(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  opts: AutoOptions = {},
): Promise<StepOutcome> {
  let outcome: 'done' | 'keep' | 'skip';
  if (opts.auto) {
    outcome = 'done';
  } else {
    const answer = await ask<'outcome'>({
      type: 'select',
      name: 'outcome',
      message: `Fáze ${phase.id} (${phase.title}) — co s ní?`,
      choices: [
        { title: 'Hotová, funguje', value: 'done' },
        { title: 'Ještě ne, nech ji doing', value: 'keep' },
        { title: 'Odložit (přeskočit fázi)', value: 'skip' },
      ],
    });
    outcome = answer.outcome as 'done' | 'keep' | 'skip';
  }

  if (outcome === 'keep') {
    log.dim('Fáze zůstává jako rozdělaná.');
    return { ok: true };
  }

  if (!opts.auto) {
    const { notes } = await ask<'notes'>({
      type: 'text',
      name: 'notes',
      message: 'Krátká poznámka (co se povedlo / co je špatně, můžeš nechat prázdné):',
      initial: '',
    });
    const trimmedNotes = (notes as string).trim();
    if (trimmedNotes) {
      phase.humanNotes = trimmedNotes;
    }
  }

  if (outcome === 'skip') {
    phase.status = 'skipped';
    log.warn(`Fáze ${phase.id} odložena.`);
  } else {
    phase.status = 'done';
    phase.completedAt = new Date().toISOString();
    log.success(`Fáze ${phase.id} (${phase.title}) hotová.`);
  }

  const next = advanceToNextPhase(state);
  logNextPhase(next);
  if (phase.status === 'done') {
    await commitPhaseWork(phase, cwd);
  }
  await save(state, cwd);
  return { ok: true, phaseAdvanced: true, nextPhaseId: next?.id ?? null };
}
