import { phaseStem } from '../state/store.js';
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
   * otevřít (typicky relativní cesta od cwd, např. `.mini/run/phase-009.prev.md`).
   */
  previousReportPath: string;
}

export interface AutoPhaseContext {
  projectMd: string;
  phase: Phase;
  discussNotes?: string | null;
  /**
   * Reference mód poznámek z diskuse (opt-in, default vypnuto). Když `true`,
   * místo inlinování `discussNotes` se vykreslí jen **odkaz** na soubor
   * `.mini/discuss/phase-{id}.md` + instrukce „přečti, jen pokud jsi je v této
   * session ještě nečetl". Použít pro interaktivní `/mini:do`, kde poznámky
   * skoro vždy už načetl `/mini:plan`/`auto` ve stejné chat session — opakovaný
   * inline by je do kontextu přilepil podruhé. Volající (context.ts) zapíná
   * příznak jen když poznámky existují, takže v reference módu se blok vykreslí
   * vždy. Headless `mini do` i `auto` zůstávají na inline (příznak vypnutý).
   */
  useDiscussNotesRef?: boolean;
  /**
   * Reference mód bloku projektu (opt-in, default vypnuto). Když `true`, místo
   * inlinování `projectMd` se pod nadpisem `# Projekt` vykreslí jen **odkaz** na
   * soubor `.mini/project.md` + instrukce „přečti, jen pokud jsi ho v této
   * session ještě nečetl". Stejná logika jako `useDiscussNotesRef`: pro
   * interaktivní `/mini:do`, kde projekt skoro vždy už načetl `/mini:plan`/`auto`
   * ve stejné chat session — opakovaný inline by ho do kontextu přilepil podruhé.
   * Headless `mini do` (jiný builder) i `auto` zůstávají na inline (vypnuto).
   */
  useProjectRef?: boolean;
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
  const { projectMd, phase, discussNotes, useDiscussNotesRef, useProjectRef, retry } = ctx;

  const reportPath = `.mini/run/${phaseStem(phase.id)}.md`;

  // Projekt: buď inline (default), nebo jen odkaz s read-once podmínkou
  // (reference mód). Reference šetří opakované načtení projektu ve stejné chat
  // session — projekt je v rámci session neměnný, takže „už ho máš, nenačítej".
  let projectBlock: string;
  if (useProjectRef) {
    projectBlock = `Projekt je popsán v \`.mini/project.md\`. Pokud jsi ho v této session už četl (typicky při \`/mini:plan\` nebo na začátku \`auto\`), **znovu ho nenačítej** — máš ho v kontextu. Jinak si ho teď přečti přes Read tool.`;
  } else {
    projectBlock = projectMd.trim();
  }

  let stepsBlock: string;
  if (phase.steps?.length) {
    const lines = phase.steps.map((s) => {
      const head = `- [${STEP_WORD[s.status]}] ${s.title}`;
      return s.detail ? `${head}\n    ${s.detail}` : head;
    });
    stepsBlock = `\nKroky (vodítko k práci — neupravuj je v žádném souboru, slouží jen jako plán a referenční názvy pro report):\n${lines.join('\n')}\n`;
  } else {
    stepsBlock = '\n(Fáze není rozmenená na kroky — pracuj na celé fázi najednou.)\n';
  }

  // Poznámky z diskuse: buď inline (default), nebo jen odkaz s read-once
  // podmínkou (reference mód). Reference šetří opakované načtení ve stejné chat
  // session — volající zapíná příznak jen když poznámky existují.
  let notesBlock: string;
  if (useDiscussNotesRef) {
    const notesPath = `.mini/discuss/${phaseStem(phase.id)}.md`;
    notesBlock = `\n# Poznámky k fázi (z diskuse)\nPoznámky z diskuse k této fázi jsou v \`${notesPath}\`. Pokud jsi je v této session už četl (typicky při \`/mini:plan\` nebo na začátku \`auto\`), **znovu je nenačítej** — máš je v kontextu. Jinak si je teď přečti přes Read tool.\n`;
  } else {
    const notes = discussNotes?.trim();
    notesBlock = notes ? `\n# Poznámky k fázi (z diskuse)\n${notes}\n` : '';
  }

  // Průběžný zápis: po každém dokončeném kroku ať Claude označí krok hotový
  // rovnou ve stavu. Když session spadne, zůstane stopa, kam až se došlo —
  // finální report jinak vzniká až úplně na konci. Dává smysl jen u fází
  // rozmenených na kroky.
  const progressBlock = phase.steps?.length
    ? `\n# Průběžný zápis kroků
Jakmile dokončíš jeden krok, **hned** ho označ za hotový (ještě než se pustíš do dalšího):

\`\`\`
mini do --apply --step-done "<přesný název kroku ze sekce Kroky>"
\`\`\`

Název kopíruj znak po znaku ze sekce "Kroky" výše. Když session spadne, ve stavu pak bude vidět, kam až ses dostal. Finální report na konci (viz níže) zapiš tak jako tak — průběžný zápis ho nenahrazuje.
`
    : '';

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
${projectBlock}
${retryBlock}
# Aktuální fáze
**Fáze ${phase.id}: ${phase.title}**
Cíl: ${phase.goal ?? '(nezadán)'}
${stepsBlock}${notesBlock}
# Tvůj úkol
Implementuj všechny zbývající kroky tak, aby fáze splnila svůj cíl. Kroky výše jsou vodítko k práci — pořadí a granularita je na tobě a soubory v \`.mini/state.json\` nijak needituj ručně. O posun stavu fáze a finální statusy kroků se postará uživatel přes \`mini done\` na základě reportu, který napíšeš (viz níže).

Soubory si přečti sám podle potřeby. Pracuješ v režimu acceptEdits, takže můžeš editovat bez doptávání.
${progressBlock}

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
