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
    log.warn('V tomto adresáři není GSD projekt (chybí .planning/).');
    return;
  }

  let preservedModels: ProjectModels | undefined;
  let preservedLegacyModel: string | undefined;
  let askModel: string | undefined;
  if (await exists(cwd)) {
    const oldState = await load(cwd);
    preservedModels = oldState.models;
    preservedLegacyModel = oldState.model;
    askModel = resolveModel('importGsd', oldState);
    log.warn('V tomto adresáři už existuje mini projekt (.mini/state.json).');
    const { ow } = await ask<'ow'>({
      type: 'confirm',
      name: 'ow',
      message: 'Přepsat ho importem z GSD?',
      initial: false,
    });
    if (!ow) {
      log.dim('Nic se nemění.');
      return;
    }
  }

  const prompt = buildImportGsdPrompt();
  log.dim('Čtu GSD projekt a sestavuju souhrn (~30-60s)…');

  let response;
  try {
    response = await askClaude(prompt, {
      cwd,
      allowedTools: ['Read', 'Glob', 'Grep'],
      timeoutMs: 180000,
      model: askModel,
    });
  } catch (err) {
    log.error(`Claude se nepodařilo zeptat: ${(err as Error).message}`);
    return;
  }

  logUsage(response);

  const parsed = parseResponse(response.text);
  if (!parsed) {
    log.warn('Claude odpověděl ve formátu, který neumím přečíst:');
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
    log.dim(`  Pro koho: ${parsed.forWhom}`);
  }
  if (parsed.constraints) {
    log.dim(`  Omezení: ${parsed.constraints}`);
  }
  console.log();
  console.log(
    `  Fází: ${parsed.phases.length} (hotové: ${counts.done}, dělají se: ${counts.doing}, čekají: ${counts.proposed}, odloženo: ${counts.skipped})`,
  );

  console.log();
  console.log('  Náhled:');
  for (const [i, p] of parsed.phases.slice(0, 5).entries()) {
    console.log(`    ${i + 1}. [${p.status}] ${p.title}`);
  }
  if (parsed.phases.length > 5) {
    console.log(`    … a dalších ${parsed.phases.length - 5}`);
  }
  console.log();

  const { ok } = await ask<'ok'>({
    type: 'confirm',
    name: 'ok',
    message: 'Importovat?',
    initial: true,
  });
  if (!ok) {
    log.dim('Zrušeno.');
    return;
  }

  const projectMd = `# ${parsed.name}

## Co stavím
${parsed.what}

## Pro koho
${parsed.forWhom || '(nezadáno)'}

## Hlavní omezení
${parsed.constraints || '(žádné)'}
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
  if (preservedLegacyModel) {
    state.model = preservedLegacyModel;
  }

  await writeProject(projectMd, cwd);
  await save(state, cwd);

  log.success('Importováno do .mini/.');
  log.hint('Spusť: mini status');
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
