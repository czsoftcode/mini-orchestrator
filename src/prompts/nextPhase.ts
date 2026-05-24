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

export interface BuildNextPhaseOptions {
  userHint?: string;
  /** Obsah `.mini/graph.md`, pokud existuje. Vloží se jako další sekce. */
  graphMd?: string;
}

export function buildNextPhasePrompt(
  projectMd: string,
  state: ProjectState,
  optionsOrHint?: BuildNextPhaseOptions | string,
): string {
  const options: BuildNextPhaseOptions =
    typeof optionsOrHint === 'string' ? { userHint: optionsOrHint } : optionsOrHint ?? {};
  const userHint = options.userHint;
  const graphMd = options.graphMd;
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

  const graph = graphMd?.trim();
  const graphBlock = graph
    ? `# Mapa projektu\nNíž je strojově vygenerovaná mapa zdrojových souborů (TS/TSX, PHP, Rust) — exporty, importy, signatury. Použij ji místo otevírání jednotlivých souborů přes Read — máš tu kompaktní přehled struktury.\n"""\n${graph}\n"""\n\n`
    : '';

  return `Jsi součástí nástroje, který pomáhá uživateli budovat projekt postupně po malých fázích.

# Projekt
${projectMd.trim()}

${history}
${graphBlock}${hintBlock}# Tvůj úkol
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
