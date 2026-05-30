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
