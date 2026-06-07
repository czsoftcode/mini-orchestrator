import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAutoPhasePrompt } from '../prompts/autoPhase.js';
import { buildDiscussPhasePrompt } from '../prompts/discussPhase.js';
import {
  buildDecisionSessionPrompt,
  buildDoneSessionPrompt,
  buildNextSessionPrompt,
  buildPlanSessionPrompt,
  buildProjectSessionPrompt,
} from '../prompts/sessionContext.js';
import { LAST_MEMORY_FILE } from '../prompts/writeMemory.js';
import { readDiscussNotes } from '../state/discussNotes.js';
import { runReportExists } from '../state/runReport.js';
import { exists, loadHeader, loadPhase, readProject } from '../state/store.js';
import { readTodos } from '../state/todoStore.js';
import type { Phase, ProjectState, StateHeader } from '../state/types.js';
import { log } from '../ui/log.js';
import { buildVerifyContext, readReportVerify } from './verifyContext.js';

/** Sub-commands for which `mini context` can print a session prompt. */
export const CONTEXT_COMMANDS = ['next', 'project', 'discuss', 'plan', 'do', 'done', 'decision', 'verify'] as const;
export type ContextCommand = (typeof CONTEXT_COMMANDS)[number];

export function isContextCommand(value: string): value is ContextCommand {
  return (CONTEXT_COMMANDS as readonly string[]).includes(value);
}

/**
 * `mini context <cmd>` — prints the current session prompt for the given
 * workflow step to stdout. Serves the native `/mini:` slash commands in Claude
 * Code: their thin body just runs `mini context <cmd>` and Claude follows the
 * printed prompt. The prompt is thus always generated from the current mini
 * state, not from frozen text in a .md file.
 *
 * Only the **prompt** goes to stdout (via `process.stdout.write`), so it can be
 * piped onward cleanly. Errors and hints go through `log` (stderr/stdout by
 * type) and set a non-zero exit code.
 */
export async function context(cmd: string, extraArgs: string[] = []): Promise<void> {
  const cwd = process.cwd();

  if (!isContextCommand(cmd)) {
    log.error(`Unknown context sub-command: "${cmd}".`);
    log.hint(`Use one of: ${CONTEXT_COMMANDS.join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  if (!(await exists(cwd))) {
    log.error('No project in this directory (.mini/state.json).');
    log.hint('Start with: mini init');
    process.exitCode = 1;
    return;
  }

  // Granular read (slash command hot path): the header is small and `next` needs
  // only the phase index from it; the other steps additionally load just the current phase.
  const [projectMd, header] = await Promise.all([readProject(cwd), loadHeader(cwd)]);

  let prompt: string | null;
  if (cmd === 'next') {
    prompt = await buildNextContext(projectMd, header, cwd, extraArgs);
  } else if (cmd === 'project') {
    // `project` enriches project.md and needs no active phase — the top-level
    // `exists` check above is enough (like `next`).
    prompt = buildProjectSessionPrompt(projectMd);
  } else if (cmd === 'verify') {
    prompt = await buildVerifyContext(header, cwd);
  } else {
    prompt = await buildPhaseContext(cmd, projectMd, header, cwd);
  }

  if (prompt === null) {
    process.exitCode = 1;
    return;
  }

  process.stdout.write(prompt.endsWith('\n') ? prompt : `${prompt}\n`);
}

/** Builds a lightweight `ProjectState` from the header — `next` takes only the phase index from it. */
function stateFromHeader(header: StateHeader): ProjectState {
  const state: ProjectState = {
    version: header.version,
    createdAt: header.createdAt,
    currentPhaseId: header.currentPhaseId,
    phases: header.phases as Phase[],
  };
  if (header.models != null) state.models = header.models;
  return state;
}

async function buildNextContext(
  projectMd: string,
  header: StateHeader,
  cwd: string,
  extraArgs: string[],
): Promise<string> {
  const userHint = extraArgs.join(' ').trim() || undefined;
  const lastMemoryMd = await readLastMemoryIfExists(cwd);
  // Keep each open item's 1-based archive position (counted over all items, like
  // `mini todo done <n>`) so the prompt can offer `--from-todo <n>`.
  const openTodos = (await readTodos(cwd))
    .map((t, i) => ({ index: i + 1, text: t.text, done: t.done }))
    .filter((t) => !t.done)
    .map(({ index, text }) => ({ index, text }));
  return buildNextSessionPrompt(projectMd, stateFromHeader(header), {
    userHint,
    lastMemoryMd,
    openTodos,
  });
}

/** Shared part for discuss/plan/do/done: they require an existing current phase. */
async function buildPhaseContext(
  cmd: Exclude<ContextCommand, 'next' | 'project' | 'verify'>,
  projectMd: string,
  header: StateHeader,
  cwd: string,
): Promise<string | null> {
  if (header.currentPhaseId === null) {
    log.error('No current phase.');
    log.hint('Run: /mini:next (or mini next)');
    return null;
  }
  const phase = await loadPhase(cwd, header.currentPhaseId);
  if (!phase) {
    log.error('State is inconsistent (currentPhaseId points to a non-existent phase).');
    return null;
  }

  if (cmd === 'discuss') {
    // Warm slash path: the project is referenced (read-once), not inlined — the
    // session usually already has it from `next` earlier in the same chat.
    return buildDiscussPhasePrompt(projectMd, phase, true);
  }
  if (cmd === 'plan') {
    const discussNotes = await readDiscussNotes(cwd, phase.id);
    // Warm slash path: reference the project rather than inlining it (read-once).
    return buildPlanSessionPrompt(projectMd, phase, discussNotes, true);
  }
  if (cmd === 'decision') {
    return buildDecisionSessionPrompt(phase);
  }
  if (cmd === 'do') {
    // `/mini:do` runs in the same chat session as `/mini:plan` (or `auto`),
    // which almost always already loaded the discussion notes — Claude has them
    // in context. Instead of inlining them again we pass only a reference-mode
    // flag (link + read-once), and only when the notes exist (otherwise the
    // builder omits the block).
    const discussNotes = await readDiscussNotes(cwd, phase.id);
    const useDiscussNotesRef = discussNotes != null && discussNotes.trim() !== '';
    // We handle the project the same way: `/mini:do` runs in the same session as
    // `/mini:plan`, which already inlined the project. The project is immutable
    // within the session, so a reference is enough (read-once) — `useProjectRef`
    // is always on (project.md exists here).
    return buildAutoPhasePrompt({
      projectMd,
      phase,
      useDiscussNotesRef,
      useProjectRef: true,
      retry: null,
    });
  }
  // done
  return buildDoneContext(phase, cwd);
}

async function buildDoneContext(phase: Phase, cwd: string): Promise<string> {
  const reportExists = await runReportExists(cwd, phase.id);
  if (!reportExists) {
    return buildDoneSessionPrompt({ phase, reportExists: false, verify: [] });
  }

  const { verify, body } = await readReportVerify(phase, cwd);
  return buildDoneSessionPrompt({ phase, reportExists: true, reportBody: body, verify });
}

async function readLastMemoryIfExists(cwd: string): Promise<string | undefined> {
  try {
    return await readFile(join(cwd, LAST_MEMORY_FILE), 'utf-8');
  } catch {
    return undefined;
  }
}
