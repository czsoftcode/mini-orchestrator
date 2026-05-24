import type { Phase, Step, StepStatus } from '../state/types.js';

export const MEMORY_DIR = '.mini/memory';
export const LAST_MEMORY_FILE = '.mini/last-memory.md';

const STEP_WORD: Record<StepStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  todo: 'čeká',
  skipped: 'odloženo',
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
    stepsBlock = `\nKroky:\n${lines.join('\n')}\n`;
  }

  const notesBlock = phase.humanNotes?.trim()
    ? `\nPoznámka uživatele:\n"""\n${phase.humanNotes.trim()}\n"""\n`
    : '';

  const contextLines: string[] = [];
  if (hasAutoCommit) {
    contextLines.push(
      '- Spusť `git show HEAD` přes Bash a podívej se na diff posledního commitu — to je práce této fáze.',
    );
  } else {
    contextLines.push(
      '- `git show HEAD` **nepouštěj** — buď tato fáze žádný commit nevytvořila, nebo nejsi v gitovém repu. Vyjdi jen z informací níže.',
    );
  }
  if (discussPath) {
    contextLines.push(`- Přečti \`${discussPath}\` — záměr fáze z diskuse před plánováním.`);
  }
  if (runReportPath) {
    contextLines.push(`- Přečti \`${runReportPath}\` — report z auto session (co se povedlo, na co Claude narazil).`);
  }
  const contextBlock = contextLines.join('\n');

  return `Jsi součástí nástroje, který pomáhá uživateli budovat projekt postupně.
Právě probíhá **zápis paměti po dokončené fázi** — NEIMPLEMENTUJ nic, nic
nerefaktoruj. Tvým jediným výstupem je soubor \`${memoryPath}\`.

# Projekt
${projectMd.trim()}

# Hotová fáze
**Fáze ${phase.id}: ${phase.title}**
Cíl: ${phase.goal ?? '(nezadán)'}
${stepsBlock}${notesBlock}
# Tvůj úkol
Zapiš stručné shrnutí toho, co se v této fázi udělalo a proč. Cílový čtenář
jsi **ty sám** v dalších fázích — \`git log\` ti řekne *co* se změnilo, memory
soubor má doplnit *proč* (rozhodnutí, kompromisy, otevřené konce).

## Jak postupovat
${contextBlock}
- Drž se faktů. Nepiš to, co si nejsi jistý.
- Krátké odrážky, žádná dlouhá prosa.

## Formát výstupu
Vytvoř soubor \`${memoryPath}\` přes \`Write\` s touto strukturou (názvy sekcí
jsou fixní; sekci smíš nechat prázdnou, pokud k ní není co napsat):

\`\`\`
# Fáze ${phase.id} — ${phase.title}

## Co se udělalo
(odrážky: konkrétní změny — nové moduly, upravené soubory, nové testy)

## Klíčová rozhodnutí
(odrážky: proč X místo Y, jaké kompromisy se dělaly, co bylo zvažováno a zamítnuto)

## Otevřené konce
(odrážky: co zůstalo nehotové, na co si dát pozor v dalších fázích, technický dluh)
\`\`\`

# Smíš použít
\`Read\` na čtení souborů projektu${hasAutoCommit ? ', `Bash` na `git show HEAD`' : ''} a \`Write\` na založení
\`${memoryPath}\`. Jiné nástroje nepotřebuješ.
`;
}
