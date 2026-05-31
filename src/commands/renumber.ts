import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_DIR } from '../prompts/writeMemory.js';
import { DISCUSS_DIR } from '../state/discussNotes.js';
import {
  buildRenumberMap,
  type DirPlan,
  executeRenames,
  findCollisions,
  planMemoryDir,
  planSimpleDir,
} from '../state/renumber.js';
import { RUN_DIR } from '../state/runReport.js';
import { exists, LegacyStateError, load, save } from '../state/store.js';
import type { ProjectState } from '../state/types.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

// Relative directory paths (DISCUSS_DIR/RUN_DIR/MEMORY_DIR are relative to cwd).
const DIR_REL = {
  discuss: DISCUSS_DIR,
  run: RUN_DIR,
  memory: MEMORY_DIR,
} as const;

export interface RenumberOptions {
  /** Only print a preview, write nothing. */
  dryRun?: boolean;
  /**
   * Confirmation before writing. Returns `true` = continue. When missing (tests),
   * it continues straight away. Not called in `--dry-run`.
   */
  confirm?: () => Promise<boolean>;
}

async function listDir(cwd: string, rel: string): Promise<string[]> {
  try {
    return await readdir(join(cwd, rel));
  } catch {
    return [];
  }
}

/**
 * `mini migrate --renumber` — renumbers the phases to consecutive integers (1..N
 * by their order in `state.json`) and unifies file names in all four directories
 * to `phase-XXX`. `phases/` + the header are handled via `save()` (writing new ids,
 * pruning old files and a backup for `undo`); `discuss/`/`run/`/`memory/` are
 * renamed by a collision-safe engine.
 *
 * Idempotent: on an already straightened project (ids `1..N` and canonical names) it is a no-op.
 */
export async function renumber(
  cwd: string = process.cwd(),
  opts: RenumberOptions = {},
): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('There is no project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  let state: ProjectState;
  try {
    state = await load(cwd);
  } catch (err) {
    if (err instanceof LegacyStateError) {
      log.error('The state is in the old format (version 1). First run `mini migrate`, then `mini migrate --renumber`.');
      return { ok: false, reason: 'legacy-state' };
    }
    throw err;
  }

  const idMap = buildRenumberMap(state.phases);

  const [phasesFiles, discussFiles, runFiles, memFiles] = await Promise.all([
    listDir(cwd, join('.mini', 'phases')),
    listDir(cwd, DIR_REL.discuss),
    listDir(cwd, DIR_REL.run),
    listDir(cwd, DIR_REL.memory),
  ]);

  // phases/ is handled by save() — the plan is only for the preview and collision check.
  const planPhases = planSimpleDir(phasesFiles, idMap);
  const planDiscuss = planSimpleDir(discussFiles, idMap);
  const planRun = planSimpleDir(runFiles, idMap);
  const planMemory = planMemoryDir(memFiles, idMap);

  const idChanges = state.phases.filter((p, i) => p.id !== i + 1);
  const totalRenames =
    planPhases.renames.length +
    planDiscuss.renames.length +
    planRun.renames.length +
    planMemory.renames.length;

  if (idChanges.length === 0 && totalRenames === 0) {
    log.info('The numbering and file names are already fine — nothing to renumber.');
    return { ok: true };
  }

  // Collisions → better abort so nothing gets overwritten.
  const dirsForCollision: { name: string; plan: DirPlan; files: string[] }[] = [
    { name: DIR_REL.discuss, plan: planDiscuss, files: discussFiles },
    { name: DIR_REL.run, plan: planRun, files: runFiles },
    { name: DIR_REL.memory, plan: planMemory, files: memFiles },
  ];
  let hasCollision = false;
  for (const d of dirsForCollision) {
    const col = findCollisions(d.plan.renames, d.files);
    if (col.length > 0) {
      hasCollision = true;
      log.error(`Name collision in ${d.name}: ${col.join(', ')} — migration stopped, nothing changed.`);
    }
  }
  if (hasCollision) {
    log.hint('Resolve the colliding files manually (rename/remove the orphans) and run again.');
    return { ok: false, reason: 'collision' };
  }

  printPreview(state, idMap, idChanges, { phases: planPhases, discuss: planDiscuss, run: planRun, memory: planMemory });

  if (opts.dryRun) {
    log.dim('(--dry-run: nothing was written)');
    return { ok: true };
  }

  if (opts.confirm && !(await opts.confirm())) {
    log.dim('Cancelled.');
    return { ok: false, reason: 'cancelled' };
  }

  // 1) State + phases/ via save(): new ids, prune old .json, backup for undo.
  const remapped: ProjectState = {
    ...state,
    currentPhaseId: state.currentPhaseId == null ? null : idMap.get(state.currentPhaseId) ?? null,
    phases: state.phases.map((p, i) => ({ ...p, id: i + 1 })),
  };
  await save(remapped, cwd);

  // 2) .md directories via the collision-safe engine.
  await executeRenames(join(cwd, DIR_REL.discuss), planDiscuss.renames);
  await executeRenames(join(cwd, DIR_REL.run), planRun.renames);
  await executeRenames(join(cwd, DIR_REL.memory), planMemory.renames);

  warnOrphans({ discuss: planDiscuss, run: planRun, memory: planMemory });

  log.success(`Renumbered ${state.phases.length} phases to 1..${state.phases.length}, file names unified.`);
  log.hint('Check `git diff`/`git status`; to roll back: `mini undo` (state) + git (files).');
  return { ok: true };
}

function printPreview(
  state: ProjectState,
  idMap: Map<number, number>,
  idChanges: ProjectState['phases'],
  plans: { phases: DirPlan; discuss: DirPlan; run: DirPlan; memory: DirPlan },
): void {
  log.info(`Renumbering ${state.phases.length} phases (order source: state.json):`);
  if (idChanges.length === 0) {
    log.dim('  (ids do not change — only file names are unified)');
  } else {
    for (const p of idChanges) {
      log.dim(`  ${p.id} → ${idMap.get(p.id)}  ${p.title}`);
    }
  }
  log.info('File renames:');
  log.dim(`  phases:  ${plans.phases.renames.length}`);
  log.dim(`  discuss: ${plans.discuss.renames.length}`);
  log.dim(`  run:     ${plans.run.renames.length}`);
  log.dim(`  memory:  ${plans.memory.renames.length}`);
  warnOrphans(plans);
}

function warnOrphans(plans: { discuss: DirPlan; run: DirPlan; memory: DirPlan }): void {
  const all = [
    ...plans.discuss.orphans,
    ...plans.run.orphans,
    ...plans.memory.orphans,
  ];
  if (all.length > 0) {
    log.warn(`Orphan files (id not in state.json) stay unchanged: ${all.join(', ')}`);
  }
}
