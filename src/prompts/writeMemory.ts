import type { Phase, Step, StepStatus } from '../state/types.js';

export const MEMORY_DIR = '.mini/memory';
export const LAST_MEMORY_FILE = '.mini/last-memory.md';

const STEP_WORD: Record<StepStatus, string> = {
  done: 'done',
  doing: 'in progress',
  todo: 'todo',
  skipped: 'skipped',
};

export interface WriteMemoryPromptInput {
  projectMd: string;
  phase: Phase;
  /** Relativní cesta k memory souboru, kam má Claude zapsat (z pohledu cwd). */
  memoryPath: string;
  /** Existuje-li `.mini/discuss/phase-{id}.md`, jeho cesta — Claude ji přečte. */
  discussPath?: string;
  /** Existuje-li `.mini/run/phase-{id}.md`, jeho cesta — Claude ji přečte. */
  runReportPath?: string;
  /** True, pokud `mini done` v této fázi udělal auto-commit a Claude může pustit `git show HEAD`. */
  hasAutoCommit: boolean;
}

export function buildWriteMemoryPrompt(input: WriteMemoryPromptInput): string {
  const { projectMd, phase, memoryPath, discussPath, runReportPath, hasAutoCommit } = input;

  let stepsBlock = '';
  if (phase.steps?.length) {
    const lines = (phase.steps as Step[]).map(
      (s) => `- [${STEP_WORD[s.status]}] ${s.title}`,
    );
    stepsBlock = `\nSteps:\n${lines.join('\n')}\n`;
  }

  const notesBlock = phase.humanNotes?.trim()
    ? `\nUser's note:\n"""\n${phase.humanNotes.trim()}\n"""\n`
    : '';

  const contextLines: string[] = [];
  if (hasAutoCommit) {
    contextLines.push(
      '- Run `git show HEAD` via Bash and look at the diff of the last commit — that is the work of this phase.',
    );
  } else {
    contextLines.push(
      '- **Do not run** `git show HEAD` — either this phase created no commit, or you are not in a git repo. Rely only on the information below.',
    );
  }
  if (discussPath) {
    contextLines.push(`- Read \`${discussPath}\` — the phase's intent from the discussion before planning.`);
  }
  if (runReportPath) {
    contextLines.push(`- Read \`${runReportPath}\` — the report from the auto session (what went well, what Claude ran into).`);
  }
  const contextBlock = contextLines.join('\n');

  return `You are part of a tool that helps the user build a project incrementally.
A **memory write after a finished phase** is in progress — DO NOT implement anything,
do not refactor anything. Your only output is the file \`${memoryPath}\`.

# Project
${projectMd.trim()}

# Finished phase
**Phase ${phase.id}: ${phase.title}**
Goal: ${phase.goal ?? '(not set)'}
${stepsBlock}${notesBlock}
# Your task
Write a brief summary of what was done in this phase and why. The target reader
is **you yourself** in later phases — \`git log\` tells you *what* changed, the memory
file should add *why* (decisions, trade-offs, loose ends).

## How to proceed
${contextBlock}
- Stick to facts. Don't write what you're not sure about.
- Short bullets, no long prose.

## Output format
Create the file \`${memoryPath}\` via \`Write\` with this structure (section names
are fixed; you may leave a section empty if there is nothing to write):

\`\`\`
# Phase ${phase.id} — ${phase.title}

## What was done
(bullets: concrete changes — new modules, edited files, new tests)

## Key decisions
(bullets: why X instead of Y, what trade-offs were made, what was considered and rejected)

## Loose ends
(bullets: what was left unfinished, what to watch out for in later phases, technical debt)
\`\`\`

# You may use
\`Read\` to read project files${hasAutoCommit ? ', `Bash` for `git show HEAD`' : ''}, and \`Write\` to create
\`${memoryPath}\`. You don't need any other tools.
`;
}
