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

/** Answers for the non-interactive `mini init --apply` (from flags, no `ask`). */
export interface ApplyInitOptions {
  /** Project name; when missing, the directory name is used. */
  name?: string;
  /** What is being built (required — validated by the CLI). */
  what?: string;
  /** Who it is for (required — validated by the CLI). */
  forWhom?: string;
  /** Main constraints (optional). */
  constraints?: string;
  /** Overwrite an existing project without asking. */
  force?: boolean;
}

/**
 * Non-interactive initialization for `/mini:init` in Claude Code: the answers come
 * as flags, no `ask` prompts. Unlike the interactive path it does **not** run the
 * audit itself — it only prints after saving whether this is an existing project
 * (brownfield) and offers the next steps (the slash command then offers `/mini:map`
 * and `/mini:audit`).
 */
export async function applyInit(opts: ApplyInitOptions): Promise<{ ok: boolean }> {
  const cwd = process.cwd();

  if ((await exists(cwd)) && !opts.force) {
    log.error('A project already exists in this directory (.mini/state.json).');
    log.hint('Start over (the old phase history will be lost): mini init --apply --force …');
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

  log.success(`Project "${answers.name}" created in .mini/`);

  if (await isBrownfield(cwd)) {
    console.log();
    log.info('There is already some code in the directory.');
    log.hint('Recommended next steps: mini map (project graph), then mini audit (codebase overview into .mini/codebase.md).');
  } else {
    log.hint('Next step: mini next');
  }

  return { ok: true };
}

export async function init(): Promise<void> {
  const cwd = process.cwd();

  if (await exists(cwd)) {
    log.warn('A project already exists in this directory (.mini/state.json).');
    const { overwrite } = await ask<'overwrite'>({
      type: 'confirm',
      name: 'overwrite',
      message: 'Overwrite and start over? (The old phase history will be lost.)',
      initial: false,
    });
    if (!overwrite) {
      log.dim('Nothing changes.');
      return;
    }
  }

  log.title('New project');
  log.hint('Answer a few questions. This creates .mini/project.md (1 page) + .mini/state.json.');

  const answers = await ask<keyof InitAnswers>([
    {
      type: 'text',
      name: 'name',
      message: 'What is the project called?',
      initial: basename(cwd),
      format: trim,
      validate: nonEmpty('The name must not be empty.'),
    },
    {
      type: 'text',
      name: 'what',
      message: 'What are you building? (1-2 sentences)',
      format: trim,
      validate: nonEmpty('Write at least a few words.'),
    },
    {
      type: 'text',
      name: 'forWhom',
      message: 'Who is it for? (target user)',
      format: trim,
      validate: nonEmpty('Write at least a few words.'),
    },
    {
      type: 'text',
      name: 'constraints',
      message: 'Main constraints? (language/framework/deadline — you can leave it empty)',
      initial: '',
      format: trim,
    },
  ]);

  const projectMd = renderProjectMd(answers as InitAnswers);

  await writeProject(projectMd, cwd);
  await save(newState(), cwd);

  // The static skeleton (.mini/ directories + .gitignore) from the same source of
  // truth as `mini update` — project.md and state.json stay generated above.
  await syncSkeleton(cwd);

  log.success(`Project "${(answers as InitAnswers).name}" created in .mini/`);

  if (await isBrownfield(cwd)) {
    console.log();
    log.info('There is already some code in the directory — I can let Claude go through the project and create .mini/codebase.md (an overview for later use).');
    const { runAudit } = await ask<'runAudit'>({
      type: 'confirm',
      name: 'runAudit',
      message: 'Run mini audit now?',
      initial: true,
    });
    if (runAudit) {
      const { audit } = await import('./audit.js');
      await audit();
      return;
    }
    log.hint('You can run it anytime: mini audit');
  }

  log.hint('For autonomous mode: enable graph auto-update after edits (a hook in .claude/settings.json) — see README "Machine-readable project map".');
  log.hint('Next step: mini next');
}

function renderProjectMd(d: InitAnswers): string {
  return `# ${d.name}

## What I'm building
${d.what}

## Who it's for
${d.forWhom}

## Main constraints
${d.constraints || '(none)'}
`;
}
