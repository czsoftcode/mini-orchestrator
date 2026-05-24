import type { PhaseStatus, ProjectState, StepStatus } from '../state/types.js';

const PHASE_WORD: Record<PhaseStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  planned: 'plán',
  proposed: 'návrh',
  skipped: 'odloženo',
};

const STEP_WORD: Record<StepStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  todo: 'čeká',
  skipped: 'odloženo',
};

export function buildNextPhasePrompt(
  projectMd: string,
  state: ProjectState,
  userHint?: string,
): string {
  const historyLines: string[] = [];
  for (const phase of state.phases) {
    historyLines.push(`- [${PHASE_WORD[phase.status]}] ${phase.id}. ${phase.title}`);
    if (phase.goal) {
      historyLines.push(`    Cíl: ${phase.goal}`);
    }
    if (phase.humanNotes) {
      historyLines.push(`    Poznámka: ${phase.humanNotes}`);
    }
    if (phase.steps?.length) {
      const stepStr = phase.steps.map((s) => `${s.title} (${STEP_WORD[s.status]})`).join(', ');
      historyLines.push(`    Kroky: ${stepStr}`);
    }
  }

  const history = historyLines.length > 0
    ? `# Dosavadní postup\n${historyLines.join('\n')}\n`
    : '# Postup\nProjekt je čerstvě založený, žádné fáze ještě nebyly.\n';

  const hint = userHint?.trim();
  const hintBlock = hint
    ? `# Nápad uživatele\nUživatel má představu, kterou chce v další fázi rozpracovat:\n"""\n${hint}\n"""\nPřesně z toho vyjdi — pojmenuj fázi a cíl tak, aby odpovídaly tomuto nápadu. Pokud je nápad příliš velký na jednu fázi (1-3 dny), vyber z něj první smysluplný kus.\n\n`
    : '';

  return `Jsi součástí nástroje, který pomáhá uživateli budovat projekt postupně po malých fázích.

# Projekt
${projectMd.trim()}

${history}
${hintBlock}# Tvůj úkol
Navrhni JEDNU další fázi. Má být malá (1-3 dny práce), s jasným, ověřitelným cílem.
Není to roadmap — jen jedna věc, co dává smysl udělat hned.

Pokud potřebuješ pochopit současný stav kódu, smíš číst soubory v projektu (Read/Glob/Grep). Nezapisuj nic.

Odpověz POUZE v tomto formátu (česky), nic jiného nepiš:

TITLE: <stručný název, max 5 slov>
GOAL: <1 věta o tom, kdy je fáze "hotová" — co konkrétně bude fungovat>

Pokud projekt považuješ za dokončený, odpověz:
TITLE: -
GOAL: -
`;
}
