import { phaseStem } from '../state/store.js';
import type { Phase, Step, StepStatus } from '../state/types.js';
import { GRAPH_USAGE_HINT } from './graphHint.js';
import { type LinkedFindingInput, renderLinkedFindingBlock } from './linkedFinding.js';
import { projectRefBlock } from './projectRef.js';

const STEP_WORD: Record<StepStatus, string> = {
  done: 'done',
  doing: 'in progress',
  todo: 'todo',
  skipped: 'skipped',
};

export function buildDiscussPhasePrompt(
  projectMd: string,
  phase: Phase,
  useProjectRef = false,
  linkedFinding?: LinkedFindingInput,
): string {
  let stepsBlock = '';
  if (phase.steps?.length) {
    const lines = (phase.steps as Step[]).map(
      (s) => `- [${STEP_WORD[s.status]}] ${s.title}`,
    );
    stepsBlock = `\nSteps:\n${lines.join('\n')}\n`;
  }

  const notesPath = `.mini/discuss/${phaseStem(phase.id)}.md`;
  const projectBlock = useProjectRef ? projectRefBlock() : projectMd.trim();
  const findingBlock = linkedFinding ? `\n${renderLinkedFindingBlock(linkedFinding)}` : '';

  return `You are part of a tool that helps the user build a project incrementally.
A **discussion session** about the upcoming phase is in progress — DO NOT implement anything.

# Project
${projectBlock}

# Phase to discuss
**Phase ${phase.id}: ${phase.title}**
Goal: ${phase.goal ?? '(not set)'}
${stepsBlock}${findingBlock}
# Your task
Discuss the intent of this phase with the user. Your goals are to:
- understand what exactly the phase should solve and why
- point out ambiguities, hidden assumptions or risks
- suggest what the goal or steps might look like (if they are not set or are vague)

${GRAPH_USAGE_HINT} Apart from the notes file (see below) do not write anything else — the session is otherwise only for discussion.

Start with a brief summary of what the phase's goal means, and then ask about what is unclear or what you consider key to clarify.

# Discussion notes
Before you end the session, write a summary of the discussion via the Write tool into the file \`${notesPath}\`. Only then end the session.

The file must have this structure (section names are fixed; individual sections may be empty or entirely absent if there is nothing to write):

\`\`\`
# Phase ${phase.id} — ${phase.title}

## Intent
## Key decisions
## Watch out for
\`\`\`

The file serves as context for the following workflow steps (\`mini plan\`, \`mini do\`), which won't see the discussion itself. Write factually and concisely — only what matters for further work.
`;
}
