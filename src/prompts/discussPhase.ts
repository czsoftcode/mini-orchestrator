import type { Phase, Step, StepStatus } from '../state/types.js';

const STEP_WORD: Record<StepStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  todo: 'čeká',
  skipped: 'odloženo',
};

export interface BuildDiscussPhaseOptions {
  /**
   * Obsah `.mini/graph.md`, pokud existuje. Vloží se do sekce "# Projekt"
   * místo `projectMd` — Claude dostane strojovou mapu projektu místo lidsky
   * psaného popisu, což je pro diskusi o konkrétní fázi užitečnější.
   */
  graphMd?: string;
}

export function buildDiscussPhasePrompt(
  projectMd: string,
  phase: Phase,
  options: BuildDiscussPhaseOptions = {},
): string {
  let stepsBlock = '';
  if (phase.steps?.length) {
    const lines = (phase.steps as Step[]).map(
      (s) => `- [${STEP_WORD[s.status]}] ${s.title}`,
    );
    stepsBlock = `\nKroky:\n${lines.join('\n')}\n`;
  }

  const notesPath = `.mini/discuss/phase-${phase.id}.md`;

  const graph = options.graphMd?.trim();
  const projectBlock = graph || projectMd.trim();

  return `Jsi součástí nástroje, který pomáhá uživateli budovat projekt postupně.
Právě probíhá **diskusní session** o nadcházející fázi — NEIMPLEMENTUJ nic.

# Projekt
${projectBlock}

# Fáze k diskusi
**Fáze ${phase.id}: ${phase.title}**
Cíl: ${phase.goal ?? '(nezadán)'}
${stepsBlock}
# Tvůj úkol
Prodiskutuj s uživatelem záměr této fáze. Tvým cílem je:
- pochopit, co má fáze přesně řešit a proč
- upozornit na nejasnosti, skryté předpoklady nebo rizika
- navrhnout, jak by mohl vypadat cíl nebo kroky (pokud nejsou zadané nebo jsou vágní)

Smíš číst soubory projektu (Read, Grep, Glob). Kromě souboru s poznámkami (viz níže) nic jiného nezapisuj — session je jinak jen pro diskusi.

Začni stručným shrnutím, co cíl fáze znamená, a pak se zeptej na to, co je nejasné nebo co považuješ za klíčové upřesnit.

# Poznámky z diskuse
Než session ukončíš, zapiš přes Write tool shrnutí diskuse do souboru \`${notesPath}\`. Teprve potom session ukonči.

Soubor musí mít tuto strukturu (názvy sekcí jsou fixní; jednotlivé sekce smí být prázdné nebo úplně chybět, pokud k nim není co napsat):

\`\`\`
# Fáze ${phase.id} — ${phase.title}

## Záměr
## Klíčová rozhodnutí
## Pozor na
\`\`\`

Soubor slouží jako kontext pro následující kroky workflow (\`mini plan\`, \`mini do\`), které samotnou diskusi neuvidí. Piš věcně a stručně — jen to, co je pro další práci podstatné.
`;
}
