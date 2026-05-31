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
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

  if (state.currentPhaseId === null) {
    log.warn('No current phase to discuss.');
    log.hint('Run: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('State is inconsistent (currentPhaseId points to a non-existent phase).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  const prompt = buildDiscussPhasePrompt(projectMd, phase);

  console.log();
  log.title('This is what I will send to Claude Code as the first message:');
  console.log();
  console.log(prompt);

  const { confirm } = await ask<'confirm'>({
    type: 'confirm',
    name: 'confirm',
    message: 'Start a discussion session with Claude Code?',
    initial: true,
  });

  if (!confirm) {
    log.dim('Cancelled. The phase status did not change.');
    return { ok: false, reason: 'cancelled' };
  }

  try {
    await mkdir(join(cwd, DISCUSS_DIR), { recursive: true });
  } catch (err) {
    log.error(`Could not create directory ${DISCUSS_DIR}: ${(err as Error).message}`);
    return { ok: false, reason: 'mkdir-error' };
  }

  log.dim('Starting Claude Code (discussion session)…');
  console.log();

  let exitCode: number;
  try {
    const result = await workWithClaude(prompt, {
      cwd,
      allowedTools: DISCUSS_ALLOWED_TOOLS,
    });
    exitCode = result.exitCode;
  } catch (err) {
    log.error(`Failed to start Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Discussion session finished.');
  } else {
    log.warn(`Claude session ended with code ${exitCode}.`);
  }

  const notesFile = `${phaseStem(phase.id)}.md`;
  const notesPath = join(cwd, DISCUSS_DIR, notesFile);
  try {
    await access(notesPath);
  } catch {
    log.dim(`Notes were not saved to ${join(DISCUSS_DIR, notesFile)} — plan and do will run without the discussion context.`);
  }

  await offerPhaseEdit(phase, cwd);

  log.hint('Next: mini plan (plan the phase steps)');
  return { ok: true };
}

async function offerPhaseEdit(phase: Phase, cwd: string): Promise<void> {
  console.log();
  log.title(`Phase ${phase.id}: ${phase.title}`);
  log.dim(`  Goal: ${phase.goal ?? '(not set)'}`);
  console.log();

  const { editIt } = await ask<'editIt'>({
    type: 'confirm',
    name: 'editIt',
    message: 'Do you want to edit the phase name or goal based on the discussion?',
    initial: false,
  });

  if (!editIt) {
    log.dim('The phase status is not changing.');
    return;
  }

  const edited = await ask<'title' | 'goal'>([
    {
      type: 'text',
      name: 'title',
      message: 'Name:',
      initial: phase.title,
      format: trim,
      validate: nonEmpty(),
    },
    {
      type: 'text',
      name: 'goal',
      message: 'Goal:',
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
    log.dim('No change.');
    return;
  }

  // re-read the state so we don't overwrite foreign changes that may have happened during the session
  const freshState = await load(cwd);
  const freshPhase = freshState.phases.find((p) => p.id === phase.id);
  if (!freshPhase) {
    log.error('The phase no longer exists in the state — saving nothing.');
    return;
  }

  freshPhase.title = newTitle;
  freshPhase.goal = newGoal;

  try {
    await save(freshState, cwd);
  } catch (err) {
    log.error(`Could not save the state: ${(err as Error).message}`);
    return;
  }

  log.success(`Phase ${phase.id} updated.`);
  if (newTitle !== oldTitle) {
    log.dim(`  Name: ${oldTitle} → ${newTitle}`);
  }
  if (newGoal !== oldGoal) {
    log.dim(`  Goal: ${oldGoal || '(empty)'} → ${newGoal}`);
  }
}
