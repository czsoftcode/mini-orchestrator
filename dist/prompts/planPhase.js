import { GRAPH_USAGE_HINT } from './graphHint.js';
export function buildPlanPhasePrompt(projectMd, phase, discussNotes) {
    const notes = discussNotes?.trim();
    const notesBlock = notes
        ? `\n# Poznámky k fázi (z diskuse)\n${notes}\n`
        : '';
    return `Jsi součástí nástroje, který pomáhá uživateli budovat projekt postupně.

# Projekt
${projectMd.trim()}

# Fáze, kterou rozmenujeme
**Fáze ${phase.id}: ${phase.title}**
Cíl: ${phase.goal ?? '(nezadán)'}
${notesBlock}
# Tvůj úkol
Rozmen tuto fázi na 3-7 konkrétních kroků. Každý krok musí mít jasný, ověřitelný výstup (např. "API endpoint /tasks vrací JSON" — ne "udělat backend").

${GRAPH_USAGE_HINT} Nezapisuj nic.

Odpověz POUZE seznamem kroků, jeden krok na řádek, ve formátu:

STEP: <stručný popis kroku, max 8 slov>
STEP: <další krok>
...

Nic jiného nepiš.
`;
}
