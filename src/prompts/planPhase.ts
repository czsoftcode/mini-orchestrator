import type { Phase } from '../state/types.js';
import { GRAPH_USAGE_HINT } from './graphHint.js';

export function buildPlanPhasePrompt(
  projectMd: string,
  phase: Phase,
  discussNotes?: string | null,
): string {
  const notes = discussNotes?.trim();
  const notesBlock = notes
    ? `\n# Phase notes (from discussion)\n${notes}\n`
    : '';

  return `You are part of a tool that helps the user build a project incrementally.

# Project
${projectMd.trim()}

# Phase to break down
**Phase ${phase.id}: ${phase.title}**
Goal: ${phase.goal ?? '(not set)'}
${notesBlock}
# Your task
Break this phase down into 3-7 concrete steps. Each step must have a clear, verifiable output (e.g. "API endpoint /tasks returns JSON" — not "build the backend").

${GRAPH_USAGE_HINT} Do not write anything.

Reply ONLY with a list of steps, one step per line, in the format:

STEP: <short description of the step, max 8 words>
STEP: <next step>
...

Write nothing else.
`;
}
