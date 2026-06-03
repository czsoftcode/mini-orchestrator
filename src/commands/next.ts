import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { askClaude } from '../claude/ask.js';
import { buildNextPhasePrompt } from '../prompts/nextPhase.js';
import { LAST_MEMORY_FILE } from '../prompts/writeMemory.js';
import { resolveModel } from '../state/models.js';
import { exists, load, readProject, save } from '../state/store.js';
import { markTodoDone } from '../state/todoStore.js';
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

/** How many attempts Claude gets at a readable phase suggestion (1 original + retry). */
const MAX_NEXT_ATTEMPTS = 2;

/** Addendum to the prompt for a retry, when the first response could not be parsed. */
const RETRY_FORMAT_NOTE = `NOTE: Your previous response could not be read — the "TITLE:" or "GOAL:" line was missing.
Answer now EXACTLY in this format, each marker at the start of its own line, nothing else:

TITLE: <concise name, max 5 words>
GOAL: <1 sentence about when the phase is done>`;

export async function next(opts: AutoOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

  let mode: NextMode;
  if (opts.auto) {
    // In auto mode we can't show the prompt — we let Claude suggest the whole phase itself.
    mode = 'estimate';
  } else {
    const answer = await ask<'mode'>({
      type: 'select',
      name: 'mode',
      message: 'Do you know what you want to build in the next phase?',
      choices: [
        { title: 'Yes, I will describe it myself', value: 'manual' },
        { title: 'I have an idea, let Claude flesh it out', value: 'hint' },
        { title: "I don't know, let Claude propose an estimate", value: 'estimate' },
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
      message: 'Your idea (1-3 sentences):',
      format: trim,
      validate: nonEmpty('Write at least a few words so Claude has something to start from.'),
    });
    userHint = hint as string;
  }

  const lastMemoryMd = await readLastMemoryIfExists(cwd);
  const prompt = buildNextPhasePrompt(projectMd, state, { userHint, lastMemoryMd });

  log.dim(userHint ? 'Fleshing out your idea…' : 'Thinking about the next phase…');

  // When Claude answers without readable `TITLE:`/`GOAL:` markers, we give it one
  // targeted retry with a format clarification before giving up with
  // `parse-failed`. Without it, a single deviation would bring down the whole
  // auto loop right in the first step.
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
      log.error(`Failed to ask Claude: ${(err as Error).message}`);
      return { ok: false, reason: 'claude-error' };
    }

    logUsage(response);
    lastText = response.text;
    parsed = parseSuggestion(response.text);
    if (parsed) {
      break;
    }
    if (attempt < MAX_NEXT_ATTEMPTS) {
      log.dim('Claude answered without TITLE:/GOAL: — trying once more with a format clarification.');
    }
  }

  if (!parsed) {
    log.warn('Claude answered in a format I cannot read:');
    console.log(lastText);
    return { ok: false, reason: 'parse-failed' };
  }

  if (parsed.title === '-') {
    log.info('Claude thinks the project is already complete.');
    log.hint("If you disagree, enter the next phase manually (for now via mini next again).");
    return { ok: false, reason: 'project-done' };
  }

  let { title, goal } = parsed;

  if (!opts.auto) {
    console.log();
    log.title(`Phase suggestion: ${parsed.title}`);
    log.dim(`  Goal: ${parsed.goal}`);
    console.log();

    const { decision } = await ask<'decision'>({
      type: 'select',
      name: 'decision',
      message: 'What do you want to do?',
      choices: [
        { title: 'Add as the next phase', value: 'add' },
        { title: 'Edit and add', value: 'edit' },
        { title: 'Cancel', value: 'cancel' },
      ],
    });

    if (decision === 'cancel') {
      log.dim('Nothing changed.');
      return { ok: false, reason: 'cancelled' };
    }

    if (decision === 'edit') {
      const edited = await ask<'title' | 'goal'>([
        {
          type: 'text',
          name: 'title',
          message: 'Name:',
          initial: title,
          format: trim,
          validate: nonEmpty(),
        },
        {
          type: 'text',
          name: 'goal',
          message: 'Goal:',
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

/**
 * Non-interactive save of a new phase — for `mini next --apply` (called by the
 * `/mini:next` slash command when Claude suggested a phase in the session). No
 * Claude, no questions: just writes the phase into the state with the same logic
 * as interactive `next` (shares `commitPhase`).
 */
export async function applyNewPhase(
  title: string,
  goal: string,
  opts: { fromTodo?: number; cwd?: string } = {},
): Promise<StepOutcome> {
  const cwd = opts.cwd ?? process.cwd();
  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }
  const state = await load(cwd);
  const outcome = await commitPhase(state, cwd, title, goal, { auto: true });
  if (outcome.ok && opts.fromTodo !== undefined) {
    await tickSourceTodo(opts.fromTodo, cwd);
  }
  return outcome;
}

/**
 * Ticks off the backlog item a phase was created from (`--from-todo <n>`). A bad
 * reference (out of range, already done, empty archive) is reported as a warning
 * only — the phase is already saved, so it must not fail the command.
 */
async function tickSourceTodo(n: number, cwd: string): Promise<void> {
  const result = await markTodoDone(n, cwd);
  switch (result.status) {
    case 'ticked':
      log.success(`Ticked off todo ${n}: ${result.text}`);
      return;
    case 'already-done':
      log.dim(`Todo ${n} was already done: ${result.text}`);
      return;
    case 'out-of-range':
      log.warn(`Could not tick off todo ${n}: no such item in the archive.`);
      return;
    case 'no-todos':
      log.warn(`Could not tick off todo ${n}: the archive is empty.`);
      return;
  }
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
      message: 'Phase name (max 5 words):',
      format: trim,
      validate: nonEmpty(),
    },
    {
      type: 'text',
      name: 'goal',
      message: 'Goal (1 sentence — when the phase is done):',
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
  // `Math.floor` on the maximum drops the fractional part of fix sub-phases
  // (21.1), otherwise a new top-level phase would get a fractional ID (22.1) and
  // break the numbering and later `nextSubphaseId`.
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

  log.success(`Added: phase ${newId} — ${title}`);
  if (!opts.auto) {
    if (wasFirst) {
      log.hint('Next: mini plan (break it down) or mini do (run directly)');
    } else {
      log.hint('Once you finish the current phase (mini done), continue with this one.');
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
 * Finds the value of the `TITLE:` / `GOAL:` marker tolerantly to the small
 * format deviations Claude occasionally makes: leading markdown decoration
 * (`#`, `*`, `-`, `>`), marker case, spaces around the colon, and wrapping
 * `**bold**`. The marker must still be at the start of the line (after any
 * decoration) — `foo TITLE: bar` is deliberately not recognized, so the parser
 * doesn't catch markers buried in prose.
 *
 * Returns `null` when the marker is missing or the value is empty after cleanup.
 */
function matchField(text: string, label: 'TITLE' | 'GOAL'): string | null {
  const re = new RegExp(`^[ \\t>*#-]*${label}[ \\t]*:[ \\t]*(.*)$`, 'im');
  const m = text.match(re);
  if (!m) {
    return null;
  }
  // Strip wrapping markdown decoration (`**bold**`, italics) and surrounding spaces.
  const value = (m[1] ?? '').replace(/^[*_\s]+/, '').replace(/[*_\s]+$/, '');
  return value.length > 0 ? value : null;
}
