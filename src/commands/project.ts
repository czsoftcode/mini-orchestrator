import { workWithClaude } from '../claude/work.js';
import { buildProjectSessionPrompt } from '../prompts/sessionContext.js';
import { type ProjectMdFields, renderProjectMd } from '../state/projectMd.js';
import { exists, readProject, writeProject } from '../state/store.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

/**
 * Tools the bare `mini project` session may use. Unlike `discuss` (Read/Write
 * only) this includes **Bash**: the agent saves the result by running
 * `mini project --apply` itself. The prompt names exactly that one command.
 */
const PROJECT_ALLOWED_TOOLS = ['Read', 'Grep', 'Glob', 'LS', 'Bash'];

/**
 * Known contract labels for `mini project --apply`, in their `project.md`
 * section order. A line is treated as a label only when it starts at column 0
 * with one of these followed by `:` (see {@link LABEL_RE}).
 */
const LABELS = [
  'NAME',
  'WHAT',
  'FOR_WHOM',
  'CONSTRAINTS',
  'APPROACH',
  'NON_GOALS',
  'SUCCESS',
] as const;
type Label = (typeof LABELS)[number];

const LABEL_RE = new RegExp(`^(${LABELS.join('|')}):(.*)$`);

/**
 * A parsed `mini project` contract. `name` and `what` are required (the parser
 * returns `null` without them); the rest are optional. `forWhom`/`constraints`
 * may be empty strings here — {@link applyProject} resolves their placeholders.
 * The Approach/Non-goals/Success fields are present only when non-empty.
 */
export interface ParsedProject {
  name: string;
  what: string;
  forWhom: string;
  constraints: string;
  approach?: string;
  nonGoals?: string;
  success?: string;
}

/** Trim, and treat a lone `-` placeholder as empty (consistent with import-gsd). */
function normalize(value: string): string {
  const v = value.trim();
  return v === '-' ? '' : v;
}

/**
 * Parses the contract sent on stdin to `mini project --apply`. A **block**
 * parser (unlike import-gsd's single-line one): a known label starts a new field
 * only when it sits at column 0 (`NAME:`, `WHAT:`, …); the value then runs across
 * every following line up to the next label or EOF, so multi-line bullet sections
 * (Approach/Non-goals/Success) survive. Each value is trimmed; a lone `-` counts
 * as empty.
 *
 * Returns `null` when the required `NAME` or `WHAT` is missing — the caller turns
 * that into a readable error (no silent fallback for required fields).
 *
 * Known limitation (accepted): a content line that itself begins at column 0 with
 * a known label + `:` is read as a new section. This is rare in the
 * machine-generated contract; indented or bulleted label-like text is safe.
 */
export function parseProjectContract(text: string): ParsedProject | null {
  const values = new Map<Label, string[]>();
  let current: Label | null = null;

  for (const line of text.split('\n')) {
    const m = line.match(LABEL_RE);
    if (m) {
      current = m[1] as Label;
      // The remainder of the label line is the first line of the value.
      values.set(current, [m[2] ?? '']);
    } else if (current) {
      values.get(current)?.push(line);
    }
    // Lines before the first label are ignored.
  }

  const get = (label: Label): string => normalize((values.get(label) ?? []).join('\n'));

  const name = get('NAME');
  const what = get('WHAT');
  if (!name || !what) {
    return null;
  }

  const parsed: ParsedProject = {
    name,
    what,
    forWhom: get('FOR_WHOM'),
    constraints: get('CONSTRAINTS'),
  };
  const approach = get('APPROACH');
  const nonGoals = get('NON_GOALS');
  const success = get('SUCCESS');
  if (approach) parsed.approach = approach;
  if (nonGoals) parsed.nonGoals = nonGoals;
  if (success) parsed.success = success;

  return parsed;
}

/**
 * Non-interactive write path for `mini project` / `/mini:project`: takes a parsed
 * contract, renders `project.md` through the shared renderer and writes it.
 *
 * **Enriches an existing project** — it requires one (`run mini init first`
 * otherwise) and touches **only** `project.md`, never `state.json`. Full replace:
 * the contract is the whole picture; placeholders for empty `forWhom`/`constraints`
 * are resolved here (the renderer stays pure layout). Optional sections are passed
 * through only when non-empty.
 */
export async function applyProject(
  parsed: ParsedProject,
  cwd: string = process.cwd(),
): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.error('No mini project in this directory (.mini/state.json is missing).');
    log.hint('Run mini init first.');
    return { ok: false, reason: 'no-project' };
  }

  const fields: ProjectMdFields = {
    name: parsed.name,
    what: parsed.what,
    forWhom: parsed.forWhom || '(not specified)',
    constraints: parsed.constraints || '(none)',
  };
  if (parsed.approach) fields.approach = parsed.approach;
  if (parsed.nonGoals) fields.nonGoals = parsed.nonGoals;
  if (parsed.success) fields.success = parsed.success;

  await writeProject(renderProjectMd(fields), cwd);
  log.success('Updated .mini/project.md');
  return { ok: true };
}

/**
 * Bare `mini project` (the terminal counterpart of `/mini:project`): opens an
 * interactive Claude Code session that enriches the existing `project.md` via the
 * shared session prompt. Mirrors `discuss.ts`, but the session may run Bash so the
 * agent can save through `mini project --apply` at the end. Requires an existing
 * project; never moves the phase state.
 */
export async function projectSession(): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Run mini init first.');
    return { ok: false, reason: 'no-project' };
  }

  const projectMd = await readProject(cwd);
  const prompt = buildProjectSessionPrompt(projectMd);

  console.log();
  log.title('This is what I will send to Claude Code as the first message:');
  console.log();
  console.log(prompt);

  const { confirm } = await ask<'confirm'>({
    type: 'confirm',
    name: 'confirm',
    message: 'Start a project-shaping session with Claude Code?',
    initial: true,
  });

  if (!confirm) {
    log.dim('Cancelled. project.md did not change.');
    return { ok: false, reason: 'cancelled' };
  }

  log.dim('Starting Claude Code (project session)…');
  console.log();

  let exitCode: number;
  try {
    const result = await workWithClaude(prompt, {
      cwd,
      allowedTools: PROJECT_ALLOWED_TOOLS,
    });
    exitCode = result.exitCode;
  } catch (err) {
    log.error(`Failed to start Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Project session finished.');
  } else {
    log.warn(`Claude session ended with code ${exitCode}.`);
  }

  log.hint('Next: mini next (propose the next phase)');
  return { ok: true };
}
