import { askClaude } from '../claude/ask.js';
import { buildNextPhasePrompt } from '../prompts/nextPhase.js';
import { resolveModel } from '../state/models.js';
import { exists, load, readProject, save } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';
import { ask, nonEmpty, trim } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';
import type { AutoOptions, StepOutcome } from './types.js';

export interface ParsedSuggestion {
  title: string;
  goal: string;
}

type NextMode = 'manual' | 'hint' | 'estimate';

export async function next(opts: AutoOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

  let mode: NextMode;
  if (opts.auto) {
    // V auto módu nemůžeme zobrazit prompt — necháme Clauda navrhnout celou fázi sám.
    mode = 'estimate';
  } else {
    const answer = await ask<'mode'>({
      type: 'select',
      name: 'mode',
      message: 'Víš, co chceš v další fázi postavit?',
      choices: [
        { title: 'Ano, popíšu to sám', value: 'manual' },
        { title: 'Mám nápad, ať to Claude rozpracuje', value: 'hint' },
        { title: 'Nevím, ať Claude navrhne odhad', value: 'estimate' },
      ],
    });
    mode = answer.mode as NextMode;
  }

  if (mode === 'manual') {
    return addPhaseManually(state, cwd, opts);
  }

  let userHint: string | undefined;
  if (mode === 'hint') {
    const { hint } = await ask<'hint'>({
      type: 'text',
      name: 'hint',
      message: 'Tvůj nápad (1-3 věty):',
      format: trim,
      validate: nonEmpty('Napiš aspoň pár slov, ať má Claude z čeho vyjít.'),
    });
    userHint = hint as string;
  }

  const prompt = buildNextPhasePrompt(projectMd, state, userHint);

  log.dim(userHint ? 'Rozpracovávám tvůj nápad…' : 'Přemýšlím nad další fází…');

  let response;
  try {
    response = await askClaude(prompt, {
      cwd,
      allowedTools: ['Read', 'Glob', 'Grep'],
      model: resolveModel('next', state),
    });
  } catch (err) {
    log.error(`Claude se nepodařilo zeptat: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  logUsage(response);

  const parsed = parseSuggestion(response.text);
  if (!parsed) {
    log.warn('Claude odpověděl ve formátu, který neumím přečíst:');
    console.log(response.text);
    return { ok: false, reason: 'parse-failed' };
  }

  if (parsed.title === '-') {
    log.info('Claude si myslí, že projekt už je dokončený.');
    log.hint('Pokud nesouhlasíš, zadej další fázi ručně (zatím přes mini next znovu).');
    return { ok: false, reason: 'project-done' };
  }

  let { title, goal } = parsed;

  if (!opts.auto) {
    console.log();
    log.title(`Návrh fáze: ${parsed.title}`);
    log.dim(`  Cíl: ${parsed.goal}`);
    console.log();

    const { decision } = await ask<'decision'>({
      type: 'select',
      name: 'decision',
      message: 'Co s tím?',
      choices: [
        { title: 'Přidat jako další fázi', value: 'add' },
        { title: 'Upravit a přidat', value: 'edit' },
        { title: 'Zrušit', value: 'cancel' },
      ],
    });

    if (decision === 'cancel') {
      log.dim('Nic se nemění.');
      return { ok: false, reason: 'cancelled' };
    }

    if (decision === 'edit') {
      const edited = await ask<'title' | 'goal'>([
        {
          type: 'text',
          name: 'title',
          message: 'Název:',
          initial: title,
          format: trim,
          validate: nonEmpty(),
        },
        {
          type: 'text',
          name: 'goal',
          message: 'Cíl:',
          initial: goal,
          format: trim,
          validate: nonEmpty(),
        },
      ]);
      title = edited.title as string;
      goal = edited.goal as string;
    }
  }

  return commitPhase(state, cwd, title, goal, opts);
}

async function addPhaseManually(
  state: ProjectState,
  cwd: string,
  opts: AutoOptions,
): Promise<StepOutcome> {
  const { title, goal } = await ask<'title' | 'goal'>([
    {
      type: 'text',
      name: 'title',
      message: 'Název fáze (max 5 slov):',
      format: trim,
      validate: nonEmpty(),
    },
    {
      type: 'text',
      name: 'goal',
      message: 'Cíl (1 věta — kdy je fáze hotová):',
      format: trim,
      validate: nonEmpty(),
    },
  ]);

  return commitPhase(state, cwd, title as string, goal as string, opts);
}

async function commitPhase(
  state: ProjectState,
  cwd: string,
  title: string,
  goal: string,
  opts: AutoOptions,
): Promise<StepOutcome> {
  const newId = Math.max(0, ...state.phases.map((p) => p.id)) + 1;
  const newPhase: Phase = {
    id: newId,
    title,
    goal,
    status: 'proposed',
  };

  state.phases.push(newPhase);
  const wasFirst = state.currentPhaseId === null;
  if (wasFirst) {
    state.currentPhaseId = newId;
  }

  await save(state, cwd);

  log.success(`Přidáno: fáze ${newId} — ${title}`);
  if (!opts.auto) {
    if (wasFirst) {
      log.hint('Další: mini plan (rozmenit) nebo mini do (spustit přímo)');
    } else {
      log.hint('Až dokončíš aktuální fázi (mini done), pokračuj touhle.');
    }
  }
  return { ok: true };
}

export function parseSuggestion(text: string): ParsedSuggestion | null {
  const titleMatch = text.match(/^TITLE:[ \t]*(.*)$/m);
  const goalMatch = text.match(/^GOAL:[ \t]*(.*)$/m);
  if (!titleMatch || !goalMatch) {
    return null;
  }
  const title = (titleMatch[1] ?? '').trim();
  const goal = (goalMatch[1] ?? '').trim();
  if (!title || !goal) {
    return null;
  }
  return { title, goal };
}
