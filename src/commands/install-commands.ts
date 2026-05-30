import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { log } from '../ui/log.js';

/** Cílový adresář pro nativní slash commandy (relativně k projektu). */
export const COMMANDS_DIR = join('.claude', 'commands', 'mini');

interface CommandDef {
  /** Název souboru bez přípony i slash command (`/mini:<name>`). */
  name: string;
  description: string;
  /** Volitelný `argument-hint` do frontmatteru. */
  argumentHint?: string;
  /** Argument za `mini context <name>` (typicky `$ARGUMENTS` u next). */
  contextArgs?: string;
  /**
   * Vlastní tělo .md (text pod frontmatterem). Když chybí, použije se výchozí
   * tělo cyklu, které pustí `mini context <name>`. Slouží read-only commandům
   * jako `status`, které žádný session prompt přes `mini context` nemají.
   */
  body?: string;
}

/**
 * Definice commandů. Tělo workflow commandů je záměrně tenké: jen pustí
 * `mini context <name>` a předá řízení vypsanému promptu. Veškerá logika a
 * aktuální kontext žijí v mini (TS), ne ve zmraženém markdownu. Read-only
 * commandy (`status`) mají vlastní `body` a žádný `mini context` nevolají.
 */
const COMMAND_DEFS: CommandDef[] = [
  {
    name: 'next',
    description: 'mini — navrhni a ulož další fázi projektu',
    argumentHint: '[volitelný nápad na fázi]',
    contextArgs: '$ARGUMENTS',
  },
  {
    name: 'discuss',
    description: 'mini — prodiskutuj aktuální fázi před plánováním',
  },
  {
    name: 'plan',
    description: 'mini — rozmen aktuální fázi na konkrétní kroky',
  },
  {
    name: 'do',
    description: 'mini — implementuj aktuální fázi a zapiš report',
    body: `Tohle je krok **do** workflow mini, spuštěný přímo v Claude Code. Implementuješ aktuální fázi a na konci zapíšeš report. Stav v \`.mini/\` měň jen příkazy \`mini ... --apply\`, nikdy needituj \`.mini/state.json\` ručně.

Postupuj v tomhle pořadí:

1. **Nastartuj fázi.** Spusť v Bash \`mini do --apply\` — fázi to označí jako rozdělanou (\`doing\`) a založí \`.mini/run/\`, aby měl průběžný zápis kroků i report kam směřovat. Spusť to **dřív**, než začneš implementovat.
2. **Načti prompt.** Spusť \`mini context do\` a řiď se vypsanými instrukcemi (kontext projektu, kroky, formát reportu).
3. **Implementuj.** Po každém dokončeném kroku ho **hned** označ za hotový: \`mini do --apply --step-done "<přesný název kroku>"\` (název kopíruj znak po znaku ze sekce „Kroky" v promptu).
4. **Zapiš report.** Na konci přes Write tool ulož report do \`.mini/run/phase-{id}.md\` přesně podle formátu z promptu (YAML statusy + volný text). Teprve potom skonči.

Když některý krok narazí na blocker, který sám neumíš obejít, zastav se a předej řízení uživateli.`,
  },
  {
    name: 'done',
    description: 'mini — lidská verifikace a posun stavu fáze',
  },
  {
    name: 'status',
    description: 'mini — přehled fází projektu (read-only)',
    body: `Tohle je krok **status** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash \`mini status\` a jeho výstup (přehled fází projektu) předej uživateli v chatu. Je to **read-only** krok — žádný stav v \`.mini/\` neměň a nic neukládej.`,
  },
  {
    name: 'map',
    description: 'mini — přegeneruj graf projektu (doplněk)',
    body: `Tohle je krok **map** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash \`mini map\` — přegeneruje graf projektu (\`.mini/graph/\` + index \`.mini/graph.json\`) ze zdrojáků. Výsledek (cestu indexu a počet zmapovaných souborů) z výstupu předej uživateli v chatu. Stav fází v \`.mini/state.json\` to nijak nemění — graf je jen derivace ze zdrojáků.`,
  },
  {
    name: 'auto',
    description: 'mini — celý cyklus fáze v jedné session',
    body: `Tohle je krok **auto** workflow mini, spuštěný přímo v Claude Code. Projdeš **celý cyklus aktuální fáze** v jedné session — postupně discuss (volitelně), plan, do a done. Každý krok pustí \`mini context <name>\` a ty se řídíš vypsaným promptem; stav v \`.mini/\` měň jen příkazy \`mini ... --apply\`, nikdy needituj \`.mini/state.json\` ručně.

Postupuj v tomhle pořadí, krok po kroku (další spusť až po dokončení předchozího):

1. **discuss (jen podmíněně).** Spusť \`mini context discuss\` **pouze** když je fáze složitá na rozhodnutí (nejednoznačný cíl, víc možných směrů, potřeba něco vyjasnit s uživatelem) **a** diskuse pro ni ještě neproběhla. U přímočaré fáze discuss **přeskoč** a jdi rovnou na plan.
2. **plan.** Spusť \`mini context plan\` a podle promptu rozmen fázi na kroky; ulož přes \`mini plan --apply\`. Když už fáze kroky má, plánování přeskoč.
3. **do.** Spusť \`mini context do\` a implementuj fázi; průběžně i finálně postupuj přesně podle jeho instrukcí (zápis kroků přes \`mini do --apply --step-done\` a report do \`.mini/run/\`).
4. **done.** Spusť \`mini context done\` a podle promptu posuň stav. Finální uložení udělej s nahráním na remote: \`mini done --apply --push\`.

Mezi kroky uživateli krátce hlas, kam ses dostal. Když některý krok narazí na blocker, který sám neumíš obejít, zastav se a předej řízení uživateli — nezbytek cyklu nedotahuj na sílu.`,
  },
];

/** Vyrenderuje obsah jednoho .md commandu. */
export function renderCommandMd(def: CommandDef): string {
  const front = [`description: ${def.description}`];
  if (def.argumentHint) {
    front.push(`argument-hint: ${def.argumentHint}`);
  }

  const contextCall = def.contextArgs
    ? `mini context ${def.name} ${def.contextArgs}`
    : `mini context ${def.name}`;
  const body =
    def.body ??
    `Tohle je krok **${def.name}** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash \`${contextCall}\` a postupuj **přesně** podle vypsaných instrukcí. Prompt obsahuje aktuální kontext projektu i to, jak na konci uložit stav (přes \`mini ... --apply\`). Stav v \`.mini/\` měň jen těmi příkazy — nikdy needituj \`.mini/state.json\` ručně.`;

  return `---
${front.join('\n')}
---

${body}
`;
}

/**
 * `mini install-commands` — vygeneruje `.claude/commands/mini/*.md` do aktuálního
 * projektu. Idempotentní: lze pustit opakovaně, přepíše jen to, co se liší, a
 * vypíše, co vzniklo / aktualizovalo se / zůstalo beze změny.
 */
export async function installCommands(cwd: string = process.cwd()): Promise<void> {
  const targetDir = join(cwd, COMMANDS_DIR);
  await mkdir(targetDir, { recursive: true });

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const def of COMMAND_DEFS) {
    const path = join(targetDir, `${def.name}.md`);
    const content = renderCommandMd(def);

    let old: string | null = null;
    try {
      old = await readFile(path, 'utf-8');
    } catch {
      old = null;
    }

    if (old === content) {
      unchanged++;
      continue;
    }

    const tmp = `${path}.tmp`;
    await writeFile(tmp, content, 'utf-8');
    await rename(tmp, path);

    if (old === null) {
      created++;
      log.success(`Vytvořeno: ${join(COMMANDS_DIR, `${def.name}.md`)}`);
    } else {
      updated++;
      log.success(`Aktualizováno: ${join(COMMANDS_DIR, `${def.name}.md`)}`);
    }
  }

  if (unchanged > 0) {
    log.dim(`${unchanged} ${unchanged === 1 ? 'command beze změny' : 'commandů beze změny'}.`);
  }

  const total = created + updated + unchanged;
  log.success(`Hotovo — ${total} commandů v ${COMMANDS_DIR}/ (${created} nových, ${updated} změněných).`);
  log.hint(
    'Použij je v Claude Code: /mini:next, /mini:discuss, /mini:plan, /mini:do, /mini:done, /mini:auto, /mini:status, /mini:map',
  );
}
