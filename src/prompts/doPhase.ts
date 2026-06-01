import { PARALLELISM_HINT } from './parallelismHint.js';
import type { Phase, Step, StepStatus } from '../state/types.js';

const STEP_WORD: Record<StepStatus, string> = {
  done: 'done',
  doing: 'in progress',
  todo: 'todo',
  skipped: 'skipped',
};

export interface DoPhaseContext {
  projectMd: string;
  phase: Phase;
  focusedStep: Step | null;
  discussNotes?: string | null;
}

export function buildDoPhasePrompt(ctx: DoPhaseContext): string {
  const { projectMd, phase, focusedStep, discussNotes } = ctx;

  let stepsBlock: string;
  if (phase.steps?.length) {
    const lines = phase.steps.map((s) => {
      const marker = s === focusedStep ? '   ← work on this' : '';
      const head = `- [${STEP_WORD[s.status]}] ${s.title}${marker}`;
      return s.detail ? `${head}\n    ${s.detail}` : head;
    });
    stepsBlock = `\nSteps:\n${lines.join('\n')}\n`;
  } else {
    stepsBlock = '\n(The phase is not broken down into steps — work on the whole phase at once.)\n';
  }

  const taskLine = focusedStep
    ? `Implement the step: "${focusedStep.title}".`
    : `Implement the whole phase so that it meets the goal.`;

  const notes = discussNotes?.trim();
  const notesBlock = notes
    ? `\n# Phase notes (from discussion)\n${notes}\n`
    : '';

  return `# Project
${projectMd.trim()}

# Current phase
**Phase ${phase.id}: ${phase.title}**
Goal: ${phase.goal ?? '(not set)'}
${stepsBlock}${notesBlock}
# Your task
${taskLine}

${PARALLELISM_HINT}

Read the files yourself as needed — they are not handed to you up front.
When you are done, end the session (type /exit or press Ctrl+D). The user then verifies manually with \`mini done\`.
`;
}
