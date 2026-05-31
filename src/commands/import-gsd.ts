import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { askClaude } from '../claude/ask.js';
import { buildImportGsdPrompt } from '../prompts/importGsd.js';
import { resolveModel } from '../state/models.js';
import { exists, load, newState, save, writeProject } from '../state/store.js';
import type { Phase, PhaseStatus, ProjectModels } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';

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

  const projectMd = `# ${parsed.name}

## What I'm building
${parsed.what}

## Who it's for
${parsed.forWhom || '(not specified)'}

## Main constraints
${parsed.constraints || '(none)'}
`;

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

  await writeProject(projectMd, cwd);
  await save(state, cwd);

  log.success('Imported into .mini/.');
  log.hint('Run: mini status');
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
