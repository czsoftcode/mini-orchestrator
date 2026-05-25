import type { Phase, StepStatus } from '../state/types.js';

const STEP_WORD: Record<StepStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  todo: 'čeká',
  skipped: 'odloženo',
};

export interface AutoPhaseRetryContext {
  /** Pořadové číslo průchodu (od 2 výš — první průchod retry nemá). */
  iteration: number;
  /**
   * Cesta k předchozímu reportu, kterou má Claude přečíst pro kontext.
   * Renderuje se rovnou do promptu, takže to musí být něco, co Claude umí
   * otevřít (typicky relativní cesta od cwd, např. `.mini/run/phase-9.prev.md`).
   */
  previousReportPath: string;
}

export interface AutoPhaseContext {
  projectMd: string;
  phase: Phase;
  discussNotes?: string | null;
  retry?: AutoPhaseRetryContext | null;
}

/**
 * Sestaví prompt pro auto-mód: jeden Claude session na celou fázi.
 *
 * Klíčový rozdíl proti `buildDoPhasePrompt`:
 * - žádný `focusedStep` — Claude má v jednom průchodu odpracovat celou fázi,
 * - Claude má na konci zapsat strukturovaný report do `.mini/run/phase-{id}.md`,
 *   ze kterého pak `done({ auto: true })` vyčte statusy kroků.
 */
export function buildAutoPhasePrompt(ctx: AutoPhaseContext): string {
  const { projectMd, phase, discussNotes, retry } = ctx;

  const reportPath = `.mini/run/phase-${phase.id}.md`;

  let stepsBlock: string;
  if (phase.steps?.length) {
    const lines = phase.steps.map((s) => `- [${STEP_WORD[s.status]}] ${s.title}`);
    stepsBlock = `\nKroky (vodítko k práci — neupravuj je v žádném souboru, slouží jen jako plán a referenční názvy pro report):\n${lines.join('\n')}\n`;
  } else {
    stepsBlock = '\n(Fáze není rozmenená na kroky — pracuj na celé fázi najednou.)\n';
  }

  const notes = discussNotes?.trim();
  const notesBlock = notes ? `\n# Poznámky k fázi (z diskuse)\n${notes}\n` : '';

  const retryBlock = retry
    ? `\n# Opakovaný pokus (průchod ${retry.iteration})
V některém z předchozích průchodů se nepodařilo dotáhnout všechny kroky. Co už je hotové (nebo odložené) uvidíš v sekci "Kroky" níže — soustřeď se na zbývající. Předchozí report najdeš v \`${retry.previousReportPath}\` — přečti si ho, ať víš, kde předchozí pokus skončil a na co narazil. Nový report (viz níže) předchozí přepíše.
`
    : '';

  // Vzorová YAML sekce kroků pro report. Klonujeme aktuální tituly, aby Claude
  // viděl přesný formát i správné názvy k překopírování. Statusy ve vzorku
  // jsou jen placeholder — Claude je má nahradit podle reálného výsledku.
  let sampleSteps: string;
  if (phase.steps?.length) {
    sampleSteps = phase.steps
      .map((s) => `  - title: "${escapeYamlDouble(s.title)}"\n    status: done`)
      .join('\n');
  } else {
    sampleSteps = '  []  # fáze nemá kroky — nech prázdný seznam';
  }

  return `Jsi součástí nástroje, který pomáhá uživateli budovat projekt postupně.
Právě probíhá **auto session** — máš v jednom průchodu implementovat celou fázi.

# Projekt
${projectMd.trim()}
${retryBlock}
# Aktuální fáze
**Fáze ${phase.id}: ${phase.title}**
Cíl: ${phase.goal ?? '(nezadán)'}
${stepsBlock}${notesBlock}
# Tvůj úkol
Implementuj všechny zbývající kroky tak, aby fáze splnila svůj cíl. Kroky výše jsou vodítko k práci — pořadí a granularita je na tobě a soubory v \`.mini/state.json\` nijak neupravuj. O posun stavu fáze a kroků se postará uživatel přes \`mini done\` na základě reportu, který napíšeš (viz níže).

Soubory si přečti sám podle potřeby. Pracuješ v režimu acceptEdits, takže můžeš editovat bez doptávání.

# Report na konci session
Než session ukončíš, **zapiš přes Write tool** report do souboru \`${reportPath}\`. Report má dvě části:

1) **YAML front matter** se strojově čitelnými statusy. Tato část se parsuje, takže struktura musí být přesná. Pravidla:
   - názvy kroků v \`steps[].title\` MUSÍ doslova odpovídat názvům v sekci "Kroky" výše (kopíruj je znak po znaku),
   - status každého kroku je právě jeden z: \`done\` (hotovo), \`skipped\` (vědomě vynecháno — vysvětli v textu), \`blocked\` (narazil jsi na blocker — popiš v textu), \`todo\` (zbývá udělat, např. nevyšel čas),
   - \`verdict\` shrnuje celou fázi a je jeden z: \`done\` (všechno hotové), \`partial\` (něco zbývá, ale nic ti nebrání pokračovat), \`blocked\` (narazil jsi na blocker, který sám neumíš obejít),
   - volitelné pole \`verify\` — seznam věcí, které jsi **sám nedokázal ověřit** a potřebují lidský pohled (vizuální UI, UX flow, subjektivní dojem). Co jde ověřit strojově (curl, testy, build), **ověř sám** a do \`verify\` to nepiš. Každá položka má \`title\` (co má člověk ověřit, povinné) a volitelně \`detail\` (kontext — co a jak jsi (ne)ověřil). Když není co ověřovat člověkem, pole vynech.

2) **Volný text** pod YAML blokem — krátké shrnutí pro člověka: co se povedlo, co ne, na co jsi narazil, otevřené otázky. Sem patří kontext, který by se do YAML statusu nevešel.

Soubor musí začínat YAML blokem přesně v tomto tvaru (uprav statusy a doplň poznámky; názvy kroků a \`phase\` neměň; \`verify\` přidej jen když je co ověřovat člověkem, jinak ho vynech):

\`\`\`
---
phase: ${phase.id}
verdict: done
steps:
${sampleSteps}
verify:   # volitelné — vynech, když Claude ověřil všechno sám
  - title: "co má člověk ověřit (vizuální/UX věc, co nejde strojově)"
    detail: "co a jak jsi (ne)ověřil"
---

# Fáze ${phase.id} — report z auto session

(volný text — co se povedlo, co ne, poznámky pro člověka)
\`\`\`

Teprve **po zapsání reportu** session ukonči (napiš /exit nebo stiskni Ctrl+D). Bez reportu uživatel nemá z čeho posunout stav — projde se pak ručně přes interaktivní \`mini done\`.
`;
}

function escapeYamlDouble(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
