import type { PhaseStatus, ProjectState } from '../state/types.js';

const PHASE_WORD: Record<PhaseStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  planned: 'plán',
  proposed: 'návrh',
  skipped: 'odloženo',
};

export interface BuildNextPhaseOptions {
  userHint?: string;
  /** Obsah `.mini/last-memory.md`, pokud existuje. Vloží se jako "# Poslední fáze". */
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
    ? `# Dosavadní postup\n${historyLines.join('\n')}\n`
    : '# Postup\nProjekt je čerstvě založený, žádné fáze ještě nebyly.\n';

  const memory = lastMemoryMd?.trim();
  const memoryBlock = memory
    ? `# Poslední fáze\nShrnutí poslední dokončené fáze (co se udělalo, na co dát pozor):\n"""\n${memory}\n"""\n\n`
    : '';

  const hint = userHint?.trim();
  const hintBlock = hint
    ? `# Nápad uživatele\nUživatel má představu, kterou chce v další fázi rozpracovat:\n"""\n${hint}\n"""\nPřesně z toho vyjdi — pojmenuj fázi a cíl tak, aby odpovídaly tomuto nápadu. Pokud je nápad příliš velký na jednu fázi (1-3 dny), vyber z něj první smysluplný kus.\n\n`
    : '';

  return `Jsi součástí nástroje, který pomáhá uživateli budovat projekt postupně po malých fázích.

# Projekt
${projectMd.trim()}

${history}
${memoryBlock}${hintBlock}# Tvůj úkol
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
