import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { askClaude } from '../claude/ask.js';
import { buildNextPhasePrompt } from '../prompts/nextPhase.js';
import { LAST_MEMORY_FILE } from '../prompts/writeMemory.js';
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

/** Kolik pokusů dostane Claude na čitelný návrh fáze (1 původní + retry). */
const MAX_NEXT_ATTEMPTS = 2;

/** Dovětek k promptu pro retry, když první odpověď nešla naparsovat. */
const RETRY_FORMAT_NOTE = `POZOR: Tvoje předchozí odpověď nešla přečíst — chyběl řádek "TITLE:" nebo "GOAL:".
Odpověz teď PŘESNĚ v tomhle formátu, každý marker na začátku vlastního řádku, nic dalšího:

TITLE: <stručný název, max 5 slov>
GOAL: <1 věta o tom, kdy je fáze hotová>`;

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

  const lastMemoryMd = await readLastMemoryIfExists(cwd);
  const prompt = buildNextPhasePrompt(projectMd, state, { userHint, lastMemoryMd });

  log.dim(userHint ? 'Rozpracovávám tvůj nápad…' : 'Přemýšlím nad další fází…');

  // Když Claude odpoví bez čitelných markerů `TITLE:`/`GOAL:`, dáme mu jeden
  // cílený retry s upřesněním formátu, než to vzdáme s `parse-failed`. Bez
  // něj by jedna odchylka shodila celou auto smyčku hned v prvním kroku.
  let parsed: ParsedSuggestion | null = null;
  let lastText = '';
  for (let attempt = 1; attempt <= MAX_NEXT_ATTEMPTS; attempt++) {
    const attemptPrompt = attempt === 1 ? prompt : `${prompt}\n\n${RETRY_FORMAT_NOTE}`;

    let response;
    try {
      response = await askClaude(attemptPrompt, {
        cwd,
        allowedTools: ['Read', 'Glob', 'Grep'],
        model: resolveModel('next', state),
      });
    } catch (err) {
      log.error(`Claude se nepodařilo zeptat: ${(err as Error).message}`);
      return { ok: false, reason: 'claude-error' };
    }

    logUsage(response);
    lastText = response.text;
    parsed = parseSuggestion(response.text);
    if (parsed) {
      break;
    }
    if (attempt < MAX_NEXT_ATTEMPTS) {
      log.dim('Claude odpověděl bez TITLE:/GOAL: — zkouším to ještě jednou s upřesněním formátu.');
    }
  }

  if (!parsed) {
    log.warn('Claude odpověděl ve formátu, který neumím přečíst:');
    console.log(lastText);
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
  // `Math.floor` na maximu zahodí desetinnou část opravných podfází (21.1),
  // jinak by nová top-level fáze dostala desetinné ID (22.1) a rozbila by
  // číslování i pozdější `nextSubphaseId`.
  const newId = Math.floor(Math.max(0, ...state.phases.map((p) => p.id))) + 1;
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

async function readLastMemoryIfExists(cwd: string): Promise<string | undefined> {
  try {
    return await readFile(join(cwd, LAST_MEMORY_FILE), 'utf-8');
  } catch {
    return undefined;
  }
}

export function parseSuggestion(text: string): ParsedSuggestion | null {
  const title = matchField(text, 'TITLE');
  const goal = matchField(text, 'GOAL');
  if (title === null || goal === null) {
    return null;
  }
  return { title, goal };
}

/**
 * Najde hodnotu markeru `TITLE:` / `GOAL:` tolerantně k drobným odchylkám
 * formátu, kterých se Claude občas dopustí: úvodní markdown dekorace
 * (`#`, `*`, `-`, `>`), velikost písmen markeru, mezery kolem dvojtečky a
 * obalující `**bold**`. Marker ale pořád musí být na začátku řádku (po
 * případné dekoraci) — `foo TITLE: bar` se záměrně neuzná, aby parser
 * nechytal markery utopené v prozaickém textu.
 *
 * Vrací `null`, když marker chybí nebo je hodnota po očištění prázdná.
 */
function matchField(text: string, label: 'TITLE' | 'GOAL'): string | null {
  const re = new RegExp(`^[ \\t>*#-]*${label}[ \\t]*:[ \\t]*(.*)$`, 'im');
  const m = text.match(re);
  if (!m) {
    return null;
  }
  // Očistíme obalující markdown dekoraci (`**bold**`, kurzíva) a okolní mezery.
  const value = (m[1] ?? '').replace(/^[*_\s]+/, '').replace(/[*_\s]+$/, '');
  return value.length > 0 ? value : null;
}
