import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAutoPhasePrompt } from '../prompts/autoPhase.js';
import { buildDiscussPhasePrompt } from '../prompts/discussPhase.js';
import {
  buildDoneSessionPrompt,
  buildNextSessionPrompt,
  buildPlanSessionPrompt,
  buildVerifySessionPrompt,
} from '../prompts/sessionContext.js';
import { LAST_MEMORY_FILE } from '../prompts/writeMemory.js';
import { readDiscussNotes } from '../state/discussNotes.js';
import {
  RunReportParseError,
  parseRunReport,
  runReportExists,
  runReportPath,
} from '../state/runReport.js';
import { exists, loadHeader, loadPhase, readProject } from '../state/store.js';
import type { Phase, ProjectState, StateHeader } from '../state/types.js';
import { log } from '../ui/log.js';

/** Sub-commands for which `mini context` can print a session prompt. */
export const CONTEXT_COMMANDS = ['next', 'discuss', 'plan', 'do', 'done', 'verify'] as const;
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
  return buildNextSessionPrompt(projectMd, stateFromHeader(header), { userHint, lastMemoryMd });
}

/** Shared part for discuss/plan/do/done: they require an existing current phase. */
async function buildPhaseContext(
  cmd: Exclude<ContextCommand, 'next'>,
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
    return buildDiscussPhasePrompt(projectMd, phase);
  }
  if (cmd === 'plan') {
    const discussNotes = await readDiscussNotes(cwd, phase.id);
    return buildPlanSessionPrompt(projectMd, phase, discussNotes);
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

/**
 * Tolerant read of the verify items and free text from the phase run report.
 * When the report can't be parsed strictly, returns empty verify (a broken
 * report is handled by `--apply`).
 */
async function readReportVerify(
  phase: Phase,
  cwd: string,
): Promise<{ verify: { title: string; detail?: string }[]; body?: string }> {
  let verify: { title: string; detail?: string }[] = [];
  let body: string | undefined;
  try {
    const raw = await readFile(runReportPath(cwd, phase.id), 'utf-8');
    const report = parseRunReport(raw, {
      expectedPhaseId: phase.id,
      expectedStepTitles: (phase.steps ?? []).map((s) => s.title),
    });
    verify = report.verify;
    body = report.body;
  } catch (err) {
    if (!(err instanceof RunReportParseError)) {
      throw err;
    }
    // Broken report — we leave verify empty, Claude goes through it without details.
  }
  return { verify, body };
}

/**
 * Prompt for `/mini:verify`. The target phase = the current one
 * (`currentPhaseId`), otherwise a fallback to the last closed (`done`) one —
 * verify is typically also run after `done`, when currentPhaseId is no longer
 * set. Without a report it only warns (verify items are drawn from it), but it
 * still leads the review based on the phase goal and steps.
 */
async function buildVerifyContext(header: StateHeader, cwd: string): Promise<string | null> {
  let phase: Phase | null = null;
  if (header.currentPhaseId !== null) {
    phase = await loadPhase(cwd, header.currentPhaseId);
  } else {
    const lastDone = [...header.phases].reverse().find((p) => p.status === 'done');
    if (lastDone) {
      phase = await loadPhase(cwd, lastDone.id);
    }
  }

  if (!phase) {
    log.error('No phase to verify (neither a current nor a closed phase).');
    log.hint('First work on a phase: /mini:next and /mini:do');
    return null;
  }

  const phaseDone = phase.status === 'done';
  const reportExists = await runReportExists(cwd, phase.id);
  const { verify, body } = reportExists
    ? await readReportVerify(phase, cwd)
    : { verify: [], body: undefined };

  return buildVerifySessionPrompt({ phase, phaseDone, verify, reportBody: body, reportExists });
}

async function readLastMemoryIfExists(cwd: string): Promise<string | undefined> {
  try {
    return await readFile(join(cwd, LAST_MEMORY_FILE), 'utf-8');
  } catch {
    return undefined;
  }
}
