import type { PhaseStatus, ProjectState } from '../state/types.js';
import { GRAPH_USAGE_HINT } from './graphHint.js';

const PHASE_WORD: Record<PhaseStatus, string> = {
  done: 'done',
  doing: 'in progress',
  planned: 'planned',
  proposed: 'proposed',
  skipped: 'skipped',
};

export interface BuildNextPhaseOptions {
  userHint?: string;
  /** Obsah `.mini/last-memory.md`, pokud existuje. Vloží se jako "# Last phase". */
  lastMemoryMd?: string;
}

export function buildNextPhasePrompt(
  projectMd: string,
  state: ProjectState,
  optionsOrHint?: BuildNextPhaseOptions | string,
): string {
  const options: BuildNextPhaseOptions =
    typeof optionsOrHint === 'string' ? { userHint: optionsOrHint } : optionsOrHint ?? {};
  const userHint = options.userHint;
  const lastMemoryMd = options.lastMemoryMd;
  const historyLines = state.phases.map(
    (phase) => `- [${PHASE_WORD[phase.status]}] ${phase.id}. ${phase.title}`,
  );

  const history = historyLines.length > 0
    ? `# Progress so far\n${historyLines.join('\n')}\n`
    : '# Progress\nThe project is brand new, there are no phases yet.\n';

  const memory = lastMemoryMd?.trim();
  const memoryBlock = memory
    ? `# Last phase\nSummary of the last finished phase (what was done, what to watch out for):\n"""\n${memory}\n"""\n\n`
    : '';

  const hint = userHint?.trim();
  const hintBlock = hint
    ? `# User's idea\nThe user has an idea they want to develop in the next phase:\n"""\n${hint}\n"""\nStart from exactly this — name the phase and goal so they match this idea. If the idea is too big for one phase (1-3 days), pick the first meaningful piece of it.\n\n`
    : '';

  return `You are part of a tool that helps the user build a project incrementally in small phases.

# Project
${projectMd.trim()}

${history}
${memoryBlock}${hintBlock}# Your task
Propose ONE next phase. It should be small (1-3 days of work), with a clear, verifiable goal.
This is not a roadmap — just one thing that makes sense to do right now.

${GRAPH_USAGE_HINT} Do not write anything.

Reply ONLY in this format, write nothing else:

TITLE: <short name, max 5 words>
GOAL: <1 sentence about when the phase is "done" — what concretely will work>

If you consider the project finished, reply:
TITLE: -
GOAL: -
`;
}
