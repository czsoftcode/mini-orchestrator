import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { workWithClaude } from '../claude/work.js';
import { buildDiscussPhasePrompt } from '../prompts/discussPhase.js';
import { exists, load, phaseStem, readProject, save } from '../state/store.js';
import type { Phase } from '../state/types.js';
import { ask, nonEmpty, trim } from '../ui/ask.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

const DISCUSS_ALLOWED_TOOLS = ['Read', 'Grep', 'Glob', 'LS', 'Write'];
const DISCUSS_DIR = join('.mini', 'discuss');

export async function discuss(): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

  if (state.currentPhaseId === null) {
    log.warn('Žádná aktuální fáze k diskusi.');
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('Stav je nekonzistentní (currentPhaseId odkazuje na neexistující fázi).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  const prompt = buildDiscussPhasePrompt(projectMd, phase);

  console.log();
  log.title('Tohle pošlu Claude Code jako první zprávu:');
  console.log();
  console.log(prompt);

  const { confirm } = await ask<'confirm'>({
    type: 'confirm',
    name: 'confirm',
    message: 'Spustit diskusní session s Claude Code?',
    initial: true,
  });

  if (!confirm) {
    log.dim('Zrušeno. Stav fáze se nezměnil.');
    return { ok: false, reason: 'cancelled' };
  }

  try {
    await mkdir(join(cwd, DISCUSS_DIR), { recursive: true });
  } catch (err) {
    log.error(`Nepodařilo se vytvořit adresář ${DISCUSS_DIR}: ${(err as Error).message}`);
    return { ok: false, reason: 'mkdir-error' };
  }

  log.dim('Spouštím Claude Code (diskusní session)…');
  console.log();

  let exitCode: number;
  try {
    const result = await workWithClaude(prompt, {
      cwd,
      allowedTools: DISCUSS_ALLOWED_TOOLS,
    });
    exitCode = result.exitCode;
  } catch (err) {
    log.error(`Claude se nepodařilo spustit: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Diskusní session ukončena.');
  } else {
    log.warn(`Claude session skončila s kódem ${exitCode}.`);
  }

  const notesFile = `${phaseStem(phase.id)}.md`;
  const notesPath = join(cwd, DISCUSS_DIR, notesFile);
  try {
    await access(notesPath);
  } catch {
    log.dim(`Poznámky nebyly uloženy do ${join(DISCUSS_DIR, notesFile)} — plan a do pojedou bez kontextu diskuse.`);
  }

  await offerPhaseEdit(phase, cwd);

  log.hint('Další: mini plan (naplánovat kroky fáze)');
  return { ok: true };
}

async function offerPhaseEdit(phase: Phase, cwd: string): Promise<void> {
  console.log();
  log.title(`Fáze ${phase.id}: ${phase.title}`);
  log.dim(`  Cíl: ${phase.goal ?? '(nezadán)'}`);
  console.log();

  const { editIt } = await ask<'editIt'>({
    type: 'confirm',
    name: 'editIt',
    message: 'Chceš upravit název nebo cíl fáze podle diskuse?',
    initial: false,
  });

  if (!editIt) {
    log.dim('Stav fáze se nemění.');
    return;
  }

  const edited = await ask<'title' | 'goal'>([
    {
      type: 'text',
      name: 'title',
      message: 'Název:',
      initial: phase.title,
      format: trim,
      validate: nonEmpty(),
    },
    {
      type: 'text',
      name: 'goal',
      message: 'Cíl:',
      initial: phase.goal ?? '',
      format: trim,
      validate: nonEmpty(),
    },
  ]);

  const newTitle = edited.title as string;
  const newGoal = edited.goal as string;
  const oldTitle = phase.title;
  const oldGoal = phase.goal ?? '';

  if (newTitle === oldTitle && newGoal === oldGoal) {
    log.dim('Beze změny.');
    return;
  }

  // přečteme stav znovu, ať nepřepíšeme cizí změny, které mohly proběhnout během session
  const freshState = await load(cwd);
  const freshPhase = freshState.phases.find((p) => p.id === phase.id);
  if (!freshPhase) {
    log.error('Fáze už ve stavu neexistuje — nic neukládám.');
    return;
  }

  freshPhase.title = newTitle;
  freshPhase.goal = newGoal;

  try {
    await save(freshState, cwd);
  } catch (err) {
    log.error(`Stav se nepodařilo uložit: ${(err as Error).message}`);
    return;
  }

  log.success(`Fáze ${phase.id} aktualizována.`);
  if (newTitle !== oldTitle) {
    log.dim(`  Název: ${oldTitle} → ${newTitle}`);
  }
  if (newGoal !== oldGoal) {
    log.dim(`  Cíl: ${oldGoal || '(prázdné)'} → ${newGoal}`);
  }
}
