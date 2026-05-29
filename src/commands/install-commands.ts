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
}

/**
 * Definice pěti commandů cyklu. Tělo každého .md je záměrně tenké: jen pustí
 * `mini context <name>` a předá řízení vypsanému promptu. Veškerá logika a
 * aktuální kontext žijí v mini (TS), ne ve zmraženém markdownu.
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
  },
  {
    name: 'done',
    description: 'mini — lidská verifikace a posun stavu fáze',
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

  return `---
${front.join('\n')}
---

Tohle je krok **${def.name}** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash \`${contextCall}\` a postupuj **přesně** podle vypsaných instrukcí. Prompt obsahuje aktuální kontext projektu i to, jak na konci uložit stav (přes \`mini ... --apply\`). Stav v \`.mini/\` měň jen těmi příkazy — nikdy needituj \`.mini/state.json\` ručně.
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
  log.hint('Použij je v Claude Code: /mini:next, /mini:discuss, /mini:plan, /mini:do, /mini:done');
}
