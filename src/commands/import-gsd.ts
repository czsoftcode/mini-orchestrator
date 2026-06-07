import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { askClaude } from '../claude/ask.js';
import { buildImportGsdPrompt } from '../prompts/importGsd.js';
import { resolveModel } from '../state/models.js';
import { renderProjectMd } from '../state/projectMd.js';
import { exists, load, newState, save, writeProject } from '../state/store.js';
import type { Phase, PhaseStatus, ProjectModels, ProjectState } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';
import type { StepOutcome } from './types.js';

interface ParsedImport {
  name: string;
  what: string;
  forWhom: string;
  constraints: string;
  phases: Array<{ title: string; status: PhaseStatus }>;
}

const STATUS_MAP: Record<string, PhaseStatus> = {
  done: 'done',
  completed: 'done',
  complete: 'done',
  finished: 'done',
  archived: 'done',
  doing: 'doing',
  in_progress: 'doing',
  inprogress: 'doing',
  'in-progress': 'doing',
  active: 'doing',
  todo: 'proposed',
  pending: 'proposed',
  proposed: 'proposed',
  planned: 'proposed',
  skipped: 'skipped',
  cancelled: 'skipped',
  canceled: 'skipped',
};

export async function importGsd(): Promise<void> {
  const cwd = process.cwd();
  const planningDir = join(cwd, '.planning');

  try {
    await access(planningDir);
  } catch {
    log.warn('There is no GSD project in this directory (.planning/ is missing).');
    return;
  }

  let preservedModels: ProjectModels | undefined;
  let askModel: string | undefined;
  if (await exists(cwd)) {
    const oldState = await load(cwd);
    preservedModels = oldState.models;
    askModel = resolveModel('importGsd', oldState);
    log.warn('A mini project already exists in this directory (.mini/state.json).');
    const { ow } = await ask<'ow'>({
      type: 'confirm',
      name: 'ow',
      message: 'Overwrite it with the GSD import?',
      initial: false,
    });
    if (!ow) {
      log.dim('Nothing changes.');
      return;
    }
  }

  const prompt = buildImportGsdPrompt();
  log.dim('Reading the GSD project and building a summary (~30-60s)…');

  let response;
  try {
    response = await askClaude(prompt, {
      cwd,
      allowedTools: ['Read', 'Glob', 'Grep'],
      timeoutMs: 180000,
      model: askModel,
    });
  } catch (err) {
    log.error(`Failed to ask Claude: ${(err as Error).message}`);
    return;
  }

  logUsage(response);

  const parsed = parseResponse(response.text);
  if (!parsed) {
    log.warn('Claude replied in a format I cannot read:');
    console.log(response.text);
    return;
  }

  const counts: Record<PhaseStatus, number> = {
    done: 0,
    doing: 0,
    proposed: 0,
    planned: 0,
    skipped: 0,
  };
  for (const p of parsed.phases) {
    counts[p.status]++;
  }

  console.log();
  log.title(`Import: ${parsed.name}`);
  log.dim(`  ${parsed.what}`);
  if (parsed.forWhom) {
    log.dim(`  For whom: ${parsed.forWhom}`);
  }
  if (parsed.constraints) {
    log.dim(`  Constraints: ${parsed.constraints}`);
  }
  console.log();
  console.log(
    `  Phases: ${parsed.phases.length} (done: ${counts.done}, doing: ${counts.doing}, todo: ${counts.proposed}, skipped: ${counts.skipped})`,
  );

  console.log();
  console.log('  Preview:');
  for (const [i, p] of parsed.phases.slice(0, 5).entries()) {
    console.log(`    ${i + 1}. [${p.status}] ${p.title}`);
  }
  if (parsed.phases.length > 5) {
    console.log(`    … and ${parsed.phases.length - 5} more`);
  }
  console.log();

  const { ok } = await ask<'ok'>({
    type: 'confirm',
    name: 'ok',
    message: 'Import?',
    initial: true,
  });
  if (!ok) {
    log.dim('Cancelled.');
    return;
  }

  await saveImport(parsed, cwd, preservedModels);

  log.success('Imported into .mini/.');
  log.hint('Run: mini status');
}

/** Builds the `project.md` body from a parsed import. */
/** Builds the state for a parsed import: phases with their statuses + the current-phase pointer. */
function buildImportState(parsed: ParsedImport, preservedModels?: ProjectModels): ProjectState {
  const state = newState();
  state.phases = parsed.phases.map(
    (p, i): Phase => ({
      id: i + 1,
      title: p.title,
      status: p.status,
    }),
  );

  const firstDoing = state.phases.find((p) => p.status === 'doing');
  const firstProposed = state.phases.find((p) => p.status === 'proposed');
  state.currentPhaseId = firstDoing?.id ?? firstProposed?.id ?? null;

  if (preservedModels) {
    state.models = preservedModels;
  }
  return state;
}

/** Writes `project.md` + `state.json` for a parsed import. */
async function saveImport(
  parsed: ParsedImport,
  cwd: string,
  preservedModels?: ProjectModels,
): Promise<void> {
  const projectMd = renderProjectMd({
    name: parsed.name,
    what: parsed.what,
    forWhom: parsed.forWhom || '(not specified)',
    constraints: parsed.constraints || '(none)',
  });
  await writeProject(projectMd, cwd);
  await save(buildImportState(parsed, preservedModels), cwd);
}

/**
 * Non-interactive import (for `/mini:import-gsd`): take the GSD extraction
 * response that the in-session Claude produced (the `NAME:/WHAT:/…/PHASES:`
 * contract), parse it preserving phase statuses, and save the project + phases.
 *
 * Refuses to overwrite an existing project unless `force` is set; on an
 * overwrite the existing model configuration is preserved. Errors (unreadable
 * response, project exists without force) are logged and returned as `ok: false`.
 */
export async function applyImport(
  text: string,
  { cwd = process.cwd(), force = false }: { cwd?: string; force?: boolean } = {},
): Promise<StepOutcome> {
  let preservedModels: ProjectModels | undefined;
  if (await exists(cwd)) {
    if (!force) {
      log.error('A mini project already exists in this directory (.mini/state.json).');
      log.hint('Re-run with --force to overwrite it (the existing phase history will be lost).');
      return { ok: false, reason: 'exists' };
    }
    preservedModels = (await load(cwd)).models;
  }

  const parsed = parseResponse(text);
  if (!parsed) {
    log.error('Could not read the GSD import response (expected the NAME/WHAT/…/PHASES contract).');
    return { ok: false, reason: 'parse' };
  }

  await saveImport(parsed, cwd, preservedModels);
  log.success(
    `Imported ${parsed.phases.length} ${parsed.phases.length === 1 ? 'phase' : 'phases'} into .mini/.`,
  );
  log.hint('Run: mini status');
  return { ok: true };
}

function normalize(value: string | undefined): string {
  const v = (value ?? '').trim();
  return v === '-' ? '' : v;
}

function parseResponse(text: string): ParsedImport | null {
  const nameMatch = text.match(/^NAME:\s*(.+)$/m);
  const whatMatch = text.match(/^WHAT:\s*(.+)$/m);
  const forWhomMatch = text.match(/^FOR_WHOM:\s*(.+)$/m);
  const constraintsMatch = text.match(/^CONSTRAINTS:\s*(.+)$/m);

  if (!nameMatch?.[1] || !whatMatch?.[1]) {
    return null;
  }

  const phases: Array<{ title: string; status: PhaseStatus }> = [];
  const phasesSection = text.split(/^PHASES:\s*$/m)[1];
  if (phasesSection) {
    for (const line of phasesSection.split('\n')) {
      const m = line.match(/^\s*\d+\s*\|\s*([a-z_-]+)\s*\|\s*(.+)$/i);
      if (m?.[1] && m?.[2]) {
        const status = STATUS_MAP[m[1].toLowerCase()];
        if (!status) {
          continue;
        }
        const title = m[2].trim();
        if (title.length > 0) {
          phases.push({ title, status });
        }
      }
    }
  }

  if (phases.length === 0) {
    return null;
  }

  return {
    name: nameMatch[1].trim(),
    what: whatMatch[1].trim(),
    forWhom: normalize(forWhomMatch?.[1]),
    constraints: normalize(constraintsMatch?.[1]),
    phases,
  };
}
