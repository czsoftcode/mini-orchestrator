import { basename } from 'node:path';
import { isBrownfield } from '../state/brownfield.js';
import { exists, newState, save, writeProject } from '../state/store.js';
import { ask, nonEmpty, trim } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { syncSkeleton } from './update.js';

interface InitAnswers {
  name: string;
  what: string;
  forWhom: string;
  constraints: string;
}

/** Odpovědi pro neinteraktivní `mini init --apply` (z flagů, bez `ask`). */
export interface ApplyInitOptions {
  /** Název projektu; když chybí, vezme se název adresáře. */
  name?: string;
  /** Co se staví (povinné — validuje CLI). */
  what?: string;
  /** Pro koho to je (povinné — validuje CLI). */
  forWhom?: string;
  /** Hlavní omezení (volitelné). */
  constraints?: string;
  /** Přepíše existující projekt bez ptaní. */
  force?: boolean;
}

/**
 * Neinteraktivní inicializace pro `/mini:init` v Claude Code: odpovědi přijdou
 * flagy, žádné `ask` prompty. Na rozdíl od interaktivní cesty **nespouští**
 * audit sám — jen po uložení vypíše, zda jde o existující projekt (brownfield),
 * a nabídne další kroky (slash command pak nabídne `/mini:map` a `/mini:audit`).
 */
export async function applyInit(opts: ApplyInitOptions): Promise<{ ok: boolean }> {
  const cwd = process.cwd();

  if ((await exists(cwd)) && !opts.force) {
    log.error('V tomto adresáři už projekt existuje (.mini/state.json).');
    log.hint('Začít nanovo (stará historie fází se ztratí): mini init --apply --force …');
    return { ok: false };
  }

  const answers: InitAnswers = {
    name: (opts.name ?? '').trim() || basename(cwd),
    what: (opts.what ?? '').trim(),
    forWhom: (opts.forWhom ?? '').trim(),
    constraints: (opts.constraints ?? '').trim(),
  };

  const projectMd = renderProjectMd(answers);

  await writeProject(projectMd, cwd);
  await save(newState(), cwd);
  await syncSkeleton(cwd);

  log.success(`Projekt "${answers.name}" založen v .mini/`);

  if (await isBrownfield(cwd)) {
    console.log();
    log.info('V adresáři už nějaký kód je.');
    log.hint('Doporučené další kroky: mini map (graf projektu), pak mini audit (přehled codebase do .mini/codebase.md).');
  } else {
    log.hint('Další krok: mini next');
  }

  return { ok: true };
}

export async function init(): Promise<void> {
  const cwd = process.cwd();

  if (await exists(cwd)) {
    log.warn('V tomto adresáři už projekt existuje (.mini/state.json).');
    const { overwrite } = await ask<'overwrite'>({
      type: 'confirm',
      name: 'overwrite',
      message: 'Přepsat a začít nanovo? (Stará historie fází se ztratí.)',
      initial: false,
    });
    if (!overwrite) {
      log.dim('Nic se nemění.');
      return;
    }
  }

  log.title('Nový projekt');
  log.hint('Odpověz na pár otázek. Vznikne .mini/project.md (1 stránka) + .mini/state.json.');

  const answers = await ask<keyof InitAnswers>([
    {
      type: 'text',
      name: 'name',
      message: 'Jak se projekt jmenuje?',
      initial: basename(cwd),
      format: trim,
      validate: nonEmpty('Název nesmí být prázdný.'),
    },
    {
      type: 'text',
      name: 'what',
      message: 'Co stavíš? (1-2 věty)',
      format: trim,
      validate: nonEmpty('Napiš aspoň pár slov.'),
    },
    {
      type: 'text',
      name: 'forWhom',
      message: 'Pro koho to je? (cílový uživatel)',
      format: trim,
      validate: nonEmpty('Napiš aspoň pár slov.'),
    },
    {
      type: 'text',
      name: 'constraints',
      message: 'Hlavní omezení? (jazyk/framework/deadline — můžeš nechat prázdné)',
      initial: '',
      format: trim,
    },
  ]);

  const projectMd = renderProjectMd(answers as InitAnswers);

  await writeProject(projectMd, cwd);
  await save(newState(), cwd);

  // Statický skeleton (.mini/ adresáře + .gitignore) ze stejného zdroje pravdy
  // jako `mini update` — project.md a state.json zůstávají generované výše.
  await syncSkeleton(cwd);

  log.success(`Projekt "${(answers as InitAnswers).name}" založen v .mini/`);

  if (await isBrownfield(cwd)) {
    console.log();
    log.info('V adresáři už nějaký kód je — můžu nechat Clauda projít projekt a vytvořit .mini/codebase.md (přehled pro pozdější use).');
    const { runAudit } = await ask<'runAudit'>({
      type: 'confirm',
      name: 'runAudit',
      message: 'Spustit teď mini audit?',
      initial: true,
    });
    if (runAudit) {
      const { audit } = await import('./audit.js');
      await audit();
      return;
    }
    log.hint('Můžeš spustit kdykoli: mini audit');
  }

  log.hint('Pro autonomní režim: zapni auto-update grafu po editaci (hook v .claude/settings.json) — viz README „Strojová mapa projektu".');
  log.hint('Další krok: mini next');
}

function renderProjectMd(d: InitAnswers): string {
  return `# ${d.name}

## Co stavím
${d.what}

## Pro koho
${d.forWhom}

## Hlavní omezení
${d.constraints || '(žádné)'}
`;
}
