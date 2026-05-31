import { askClaude } from '../claude/ask.js';
import { buildPlanPhasePrompt } from '../prompts/planPhase.js';
import { readDiscussNotes } from '../state/discussNotes.js';
import { resolveModel } from '../state/models.js';
import { exists, load, readProject, save } from '../state/store.js';
import type { Step } from '../state/types.js';
import { ask, trim } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';
import type { AutoOptions, StepOutcome } from './types.js';

export async function plan(opts: AutoOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

  if (state.currentPhaseId === null) {
    log.warn('No current phase to plan.');
    log.hint('Run: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('State is inconsistent (currentPhaseId points to a non-existent phase).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done' || phase.status === 'skipped') {
    log.info(`Phase ${phase.id} is no longer active (${phase.status}).`);
    return { ok: false, reason: 'phase-not-active' };
  }

  if (phase.steps?.length) {
    if (opts.auto) {
      log.dim(`Phase ${phase.id} already has ${phase.steps.length} ${phase.steps.length === 1 ? 'step' : 'steps'} — overwriting in auto mode.`);
    } else {
      log.warn(`Phase ${phase.id} already has ${phase.steps.length} ${phase.steps.length === 1 ? 'step' : 'steps'}.`);
      const { ow } = await ask<'ow'>({
        type: 'confirm',
        name: 'ow',
        message: 'Overwrite them with a new plan?',
        initial: false,
      });
      if (!ow) {
        log.dim('Nothing changed.');
        return { ok: false, reason: 'cancelled' };
      }
    }
  }

  const discussNotes = await readDiscussNotes(cwd, phase.id);
  const prompt = buildPlanPhasePrompt(projectMd, phase, discussNotes);
  log.dim('Thinking about the steps…');

  let response;
  try {
    response = await askClaude(prompt, { cwd, allowedTools: ['Read', 'Glob', 'Grep'], model: resolveModel('plan', state) });
  } catch (err) {
    log.error(`Failed to ask Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  logUsage(response);

  let titles = parseSteps(response.text);
  if (titles.length === 0) {
    log.warn('Claude answered in a format I cannot read:');
    console.log(response.text);
    return { ok: false, reason: 'parse-failed' };
  }

  if (!opts.auto) {
    console.log();
    log.title(`Suggested steps (${titles.length}):`);
    titles.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t}`);
    });
    console.log();

    const { decision } = await ask<'decision'>({
      type: 'select',
      name: 'decision',
      message: 'What do you want to do?',
      choices: [
        { title: 'Use them as they are', value: 'use' },
        { title: 'Edit (one step at a time, empty = delete)', value: 'edit' },
        { title: 'Cancel', value: 'cancel' },
      ],
    });

    if (decision === 'cancel') {
      log.dim('Nothing changed.');
      return { ok: false, reason: 'cancelled' };
    }

    if (decision === 'edit') {
      const edited: string[] = [];
      for (let i = 0; i < titles.length; i++) {
        const { title } = await ask<'title'>({
          type: 'text',
          name: 'title',
          message: `Step ${i + 1}:`,
          initial: titles[i],
          format: trim,
        });
        if ((title as string).length > 0) {
          edited.push(title as string);
        }
      }
      if (edited.length === 0) {
        log.warn('No steps left. Nothing changed.');
        return { ok: false, reason: 'cancelled' };
      }
      titles = edited;
    }
  }

  const steps: Step[] = titles.map((title) => ({ title, status: 'todo' }));
  phase.steps = steps;
  if (phase.status === 'proposed') {
    phase.status = 'planned';
  }
  await save(state, cwd);

  log.success(`Phase ${phase.id} broken down into ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}.`);
  if (!opts.auto) {
    log.hint('Next: mini do');
  }
  return { ok: true };
}

/**
 * Non-interactive save of the current phase's steps — for `mini plan --apply`
 * (called by `/mini:plan` when Claude broke the phase down in the session). No
 * Claude: just writes the given steps into the state with the same logic as
 * interactive `plan`.
 */
export async function applyPlanSteps(
  parsed: ParsedStep[],
  cwd: string = process.cwd(),
): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const clean = parsed
    .map((p) => ({ title: p.title.trim(), detail: p.detail?.trim() }))
    .filter((p) => p.title.length > 0);
  if (clean.length === 0) {
    log.error('I received no steps (stdin was empty).');
    return { ok: false, reason: 'no-steps' };
  }

  const state = await load(cwd);

  if (state.currentPhaseId === null) {
    log.warn('No current phase to plan.');
    log.hint('Run: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('State is inconsistent (currentPhaseId points to a non-existent phase).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done' || phase.status === 'skipped') {
    log.info(`Phase ${phase.id} is no longer active (${phase.status}).`);
    return { ok: false, reason: 'phase-not-active' };
  }

  const steps: Step[] = clean.map((p) => ({
    title: p.title,
    status: 'todo',
    ...(p.detail ? { detail: p.detail } : {}),
  }));
  phase.steps = steps;
  if (phase.status === 'proposed') {
    phase.status = 'planned';
  }
  await save(state, cwd);

  log.success(`Phase ${phase.id} broken down into ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}.`);
  return { ok: true };
}

/** Separator `title :: detail` on a single stdin line. The spaces around `::`
 * make it robust against stray colons in the title or detail text. */
const STEP_DETAIL_SEPARATOR = ' :: ';

/** A step parsed from stdin: a short `title` + an optional planning `detail`. */
export interface ParsedStep {
  title: string;
  detail?: string;
}

/**
 * Parses the steps passed on stdin for `mini plan --apply`. Tolerant to how
 * Claude writes them: takes every non-empty line as one step and strips common
 * list prefixes (`STEP:`, `- `, `* `, `1. `).
 *
 * Line format: `title :: detail`. The ` :: ` separator is optional — a line
 * without it is just a `title` (backward compatibility with the old "one title
 * per line"). The first occurrence of the separator is used; an empty `detail`
 * is omitted.
 */
export function parseStepsFromStdin(text: string): ParsedStep[] {
  const out: ParsedStep[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (line.length === 0) continue;
    line = line.replace(/^STEP:\s*/i, '');
    line = line.replace(/^[-*]\s+/, '');
    line = line.replace(/^\d+[.)]\s+/, '');
    line = line.trim();
    if (line.length === 0) continue;

    // A dangling separator at the end of the line (`title ::`) = empty detail.
    // The `trim()` above removed the trailing space, so ` :: ` won't catch it —
    // we handle it separately.
    if (line.endsWith(' ::')) {
      const title = line.slice(0, -' ::'.length).trim();
      if (title.length > 0) out.push({ title });
      continue;
    }

    const sep = line.indexOf(STEP_DETAIL_SEPARATOR);
    if (sep === -1) {
      out.push({ title: line });
      continue;
    }
    const title = line.slice(0, sep).trim();
    const detail = line.slice(sep + STEP_DETAIL_SEPARATOR.length).trim();
    if (title.length === 0) continue;
    out.push(detail.length > 0 ? { title, detail } : { title });
  }
  return out;
}

export function parseSteps(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^STEP:\s*(.+)$/);
    if (m?.[1]) {
      const t = m[1].trim();
      if (t.length > 0) {
        out.push(t);
      }
    }
  }
  return out;
}
