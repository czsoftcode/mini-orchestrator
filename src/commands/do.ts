import { streamWithClaude } from '../claude/stream.js';
import { workWithClaude } from '../claude/work.js';
import { buildAutoPhasePrompt, type AutoPhaseRetryContext } from '../prompts/autoPhase.js';
import { buildDoPhasePrompt } from '../prompts/doPhase.js';
import { readDiscussNotes } from '../state/discussNotes.js';
import { resolveModel } from '../state/models.js';
import { ensureRunDir } from '../state/runReport.js';
import { exists, load, readProject, save } from '../state/store.js';
import type { Step } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { createStreamRenderer } from '../ui/streamRender.js';
import { logStreamSummary } from '../ui/usage.js';
import type { AutoOptions, StepOutcome } from './types.js';

export interface DoPhaseOptions extends AutoOptions {
  /**
   * Kontext pro retry v auto módu. Nastavuje `auto.ts` druhému a třetímu
   * pokusu — Claude tak v promptu uvidí, že jde o opakování, a najde tam
   * cestu k předchozímu reportu.
   */
  retry?: AutoPhaseRetryContext | null;
}

export async function doPhase(opts: DoPhaseOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

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
    log.info(`Fáze ${phase.id} (${phase.title}) je už hotová.`);
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'phase-done' };
  }
  if (phase.status === 'skipped') {
    log.info(`Fáze ${phase.id} (${phase.title}) je odložená.`);
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'phase-skipped' };
  }

  // V auto módu pouštíme Claude na celou fázi v jednom průchodu — nepicujeme
  // focusedStep. V interaktivním módu zůstává krokový workflow: Claude dostane
  // jeden konkrétní krok a po něm uživatel ručně ověří přes `mini done`.
  let focusedStep: Step | null = null;
  if (!opts.auto && phase.steps?.length) {
    focusedStep =
      phase.steps.find((s) => s.status === 'doing') ??
      phase.steps.find((s) => s.status === 'todo') ??
      null;
    if (!focusedStep) {
      log.info(`Všechny kroky fáze ${phase.id} jsou hotové (nebo odložené).`);
      log.hint('Spusť: mini done (označit fázi jako hotovou)');
      return { ok: false, reason: 'all-steps-done' };
    }
  }

  // V auto módu se safety-check „všechny kroky hotové" dělá taky, ale jinak —
  // bez kroku k focusu by Claude jen nasucho vygeneroval prázdný report.
  if (opts.auto && phase.steps?.length) {
    const stillOpen = phase.steps.some((s) => s.status !== 'done' && s.status !== 'skipped');
    if (!stillOpen) {
      log.info(`Všechny kroky fáze ${phase.id} jsou hotové (nebo odložené).`);
      log.hint('Spusť: mini done (označit fázi jako hotovou)');
      return { ok: false, reason: 'all-steps-done' };
    }
  }

  const discussNotes = await readDiscussNotes(cwd, phase.id);
  const prompt = opts.auto
    ? buildAutoPhasePrompt({ projectMd, phase, discussNotes, retry: opts.retry ?? null })
    : buildDoPhasePrompt({ projectMd, phase, focusedStep, discussNotes });

  if (opts.auto) {
    const modeNote = opts.stream ? ' (--stream, --permission-mode acceptEdits)' : ' (--permission-mode acceptEdits)';
    log.dim(`Auto: spouštím Claude na celou fázi ${phase.id}${modeNote}.`);
  } else {
    console.log();
    log.title('Tohle pošlu Claude Code jako první zprávu:');
    console.log();
    console.log(prompt);

    const modeQuestion = opts.stream
      ? 'Spustit Claude v print-módu se streamovaným JSON výstupem?'
      : 'Spustit Claude Code s tímto promptem?';
    const { confirm } = await ask<'confirm'>({
      type: 'confirm',
      name: 'confirm',
      message: modeQuestion,
      initial: true,
    });

    if (!confirm) {
      log.dim('Zrušeno. Stav fáze se nezměnil.');
      return { ok: false, reason: 'cancelled' };
    }
  }

  phase.status = 'doing';
  if (!phase.startedAt) {
    phase.startedAt = new Date().toISOString();
  }
  if (focusedStep) {
    focusedStep.status = 'doing';
  }
  await save(state, cwd);

  // V auto módu Claude na konci session zapisuje report do `.mini/run/phase-{id}.md`.
  // Adresář musíme vytvořit dopředu — Claude jinak při Write narazí na chybějící cestu.
  if (opts.auto) {
    await ensureRunDir(cwd);
  }

  if (!opts.auto) {
    log.dim(opts.stream ? 'Spouštím Claude Code (stream)…' : 'Spouštím Claude Code…');
  }
  console.log();

  const model = resolveModel('do', state);
  const permissionMode = opts.auto ? 'acceptEdits' : undefined;

  let exitCode: number;
  try {
    if (opts.stream) {
      const renderer = createStreamRenderer();
      const streamResult = await streamWithClaude(prompt, {
        cwd,
        permissionMode,
        model,
        maxTurns: opts.maxTurns,
        onEvent: renderer.onEvent,
        onParseError: (line, err) => {
          log.warn(`Nečitelná řádka ze streamu (${err.message}): ${line.slice(0, 120)}`);
        },
      });
      console.log();
      logStreamSummary(streamResult);
      exitCode = streamResult.exitCode;
    } else {
      const result = await workWithClaude(prompt, {
        cwd,
        permissionMode,
        model,
        maxTurns: opts.maxTurns,
      });
      exitCode = result.exitCode;
    }
  } catch (err) {
    log.error(`Claude se nepodařilo spustit: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Claude session ukončena.');
  } else {
    log.warn(`Claude session skončila s kódem ${exitCode}.`);
  }
  if (!opts.auto) {
    log.hint('Další: mini done (ověřit a posunout stav)');
  }
  return { ok: true };
}

/**
 * Neinteraktivní příprava fáze před implementací v session — pro `mini do
 * --apply` (volá ho `/mini:do` před tím, než Claude začne pracovat). Označí
 * fázi jako `doing`, nastaví `startedAt` a založí `.mini/run/` adresář, aby měl
 * Claude kam zapsat report. Žádný Claude, žádná implementace.
 */
export async function applyDoStart(cwd: string = process.cwd()): Promise<StepOutcome> {
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
    log.info(`Fáze ${phase.id} (${phase.title}) je už hotová.`);
    return { ok: false, reason: 'phase-done' };
  }
  if (phase.status === 'skipped') {
    log.info(`Fáze ${phase.id} (${phase.title}) je odložená.`);
    return { ok: false, reason: 'phase-skipped' };
  }

  phase.status = 'doing';
  if (!phase.startedAt) {
    phase.startedAt = new Date().toISOString();
  }
  await save(state, cwd);
  await ensureRunDir(cwd);

  log.success(`Fáze ${phase.id} (${phase.title}) označena jako rozdělaná.`);
  return { ok: true };
}

/**
 * Najde krok podle názvu tolerantně: nejdřív přesnou shodu (po `trim`), pak
 * shodu bez ohledu na velikost písmen. Vrátí `null`, když nic nesedí. Drží
 * stejnou logiku jako párování titulků v reportu — Claude název kopíruje ze
 * sekce "Kroky", ale drobné odchylky (mezery, velikost) nemají rozbít zápis.
 */
function findStepByTitle(steps: Step[], title: string): Step | null {
  const wanted = title.trim();
  const exact = steps.find((s) => s.title.trim() === wanted);
  if (exact) return exact;
  const lower = wanted.toLowerCase();
  return steps.find((s) => s.title.trim().toLowerCase() === lower) ?? null;
}

/**
 * Neinteraktivní průběžný zápis jednoho hotového kroku — pro `mini do --apply
 * --step-done "<název>"`. Volá ho Claude během `/mini:do` hned po dokončení
 * každého kroku, takže když session spadne, ve `state.json` zůstane stopa, kam
 * až se došlo (na rozdíl od finálního reportu, který vzniká až na konci).
 *
 * Označí krok aktuální fáze `done` a ihned uloží stav. Vyžaduje, aby fáze byla
 * `doing` (tj. po `mini do --apply`) — jinak vrátí chybu, ať se status nezapisuje
 * mimo aktivní session. Posun fáze ani závěrečné statusy nedělá: o ně se pořád
 * stará `mini done` z reportu.
 */
export async function applyStepDone(title: string, cwd: string = process.cwd()): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const wanted = title.trim();
  if (wanted.length === 0) {
    log.error('Chybí název kroku (--step-done "<název>").');
    return { ok: false, reason: 'no-step-title' };
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

  if (phase.status !== 'doing') {
    log.error(`Fáze ${phase.id} není rozdělaná (stav: ${phase.status}).`);
    log.hint('Nejdřív spusť: mini do --apply');
    return { ok: false, reason: 'phase-not-doing' };
  }

  if (!phase.steps?.length) {
    log.error(`Fáze ${phase.id} nemá žádné kroky.`);
    return { ok: false, reason: 'no-steps' };
  }

  const step = findStepByTitle(phase.steps, wanted);
  if (!step) {
    log.error(`Krok "${wanted}" jsem ve fázi ${phase.id} nenašel.`);
    log.hint('Použij přesný název kroku ze sekce "Kroky" v promptu.');
    return { ok: false, reason: 'step-not-found' };
  }

  if (step.status === 'done') {
    log.dim(`Krok "${step.title}" už je hotový.`);
    return { ok: true };
  }

  step.status = 'done';
  await save(state, cwd);

  log.success(`Krok "${step.title}" označen jako hotový.`);
  return { ok: true };
}
