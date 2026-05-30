import type { Phase, Step, StepStatus } from '../state/types.js';

const STEP_WORD: Record<StepStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  todo: 'čeká',
  skipped: 'odloženo',
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
      const marker = s === focusedStep ? '   ← pracuj na tomhle' : '';
      const head = `- [${STEP_WORD[s.status]}] ${s.title}${marker}`;
      return s.detail ? `${head}\n    ${s.detail}` : head;
    });
    stepsBlock = `\nKroky:\n${lines.join('\n')}\n`;
  } else {
    stepsBlock = '\n(Fáze není rozmenená na kroky — pracuj na celé fázi najednou.)\n';
  }

  const taskLine = focusedStep
    ? `Implementuj krok: "${focusedStep.title}".`
    : `Implementuj celou fázi tak, aby splňovala cíl.`;

  const notes = discussNotes?.trim();
  const notesBlock = notes
    ? `\n# Poznámky k fázi (z diskuse)\n${notes}\n`
    : '';

  return `# Projekt
${projectMd.trim()}

# Aktuální fáze
**Fáze ${phase.id}: ${phase.title}**
Cíl: ${phase.goal ?? '(nezadán)'}
${stepsBlock}${notesBlock}
# Tvůj úkol
${taskLine}

Soubory si přečti sám podle potřeby — nepředávám ti je předem.
Když budeš mít hotovo, ukonči session (napiš /exit nebo stiskni Ctrl+D). Uživatel pak ověří ručně příkazem \`mini done\`.
`;
}
