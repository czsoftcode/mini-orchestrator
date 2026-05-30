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

// Relativní cesty adresářů (DISCUSS_DIR/RUN_DIR/MEMORY_DIR jsou relativní k cwd).
const DIR_REL = {
  discuss: DISCUSS_DIR,
  run: RUN_DIR,
  memory: MEMORY_DIR,
} as const;

export interface RenumberOptions {
  /** Jen vypsat náhled, nic nezapisovat. */
  dryRun?: boolean;
  /**
   * Potvrzení před zápisem. Vrací `true` = pokračovat. Když chybí (testy),
   * pokračuje se rovnou. V `--dry-run` se nevolá.
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
 * `mini migrate --renumber` — přečísluje fáze na souvislá celá čísla (1..N podle
 * pořadí ve `state.json`) a sjednotí názvy souborů ve všech čtyřech adresářích na
 * `phase-XXX`. `phases/` + hlavičku řeší přes `save()` (zápis nových id, prune
 * starých souborů i záloha pro `undo`); `discuss/`/`run/`/`memory/` přejmenuje
 * kolizně bezpečným enginem.
 *
 * Idempotentní: na už narovnaném projektu (id `1..N` a kanonické názvy) je no-op.
 */
export async function renumber(
  cwd: string = process.cwd(),
  opts: RenumberOptions = {},
): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  let state: ProjectState;
  try {
    state = await load(cwd);
  } catch (err) {
    if (err instanceof LegacyStateError) {
      log.error('Stav je ve starém formátu (verze 1). Nejdřív spusť `mini migrate`, pak `mini migrate --renumber`.');
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

  // phases/ řeší save() — plán slouží jen k náhledu a kontrole kolizí.
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
    log.info('Číslování i názvy souborů jsou už v pořádku — není co přečíslovat.');
    return { ok: true };
  }

  // Kolize → raději abort, ať se nic nepřepíše.
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
      log.error(`Kolize názvů v ${d.name}: ${col.join(', ')} — migrace zastavena, nic se nezměnilo.`);
    }
  }
  if (hasCollision) {
    log.hint('Vyřeš kolidující soubory ručně (přejmenuj/odstraň orphany) a spusť znovu.');
    return { ok: false, reason: 'collision' };
  }

  printPreview(state, idMap, idChanges, { phases: planPhases, discuss: planDiscuss, run: planRun, memory: planMemory });

  if (opts.dryRun) {
    log.dim('(--dry-run: nic se nezapsalo)');
    return { ok: true };
  }

  if (opts.confirm && !(await opts.confirm())) {
    log.dim('Zrušeno.');
    return { ok: false, reason: 'cancelled' };
  }

  // 1) Stav + phases/ přes save(): nová id, prune starých .json, záloha pro undo.
  const remapped: ProjectState = {
    ...state,
    currentPhaseId: state.currentPhaseId == null ? null : idMap.get(state.currentPhaseId) ?? null,
    phases: state.phases.map((p, i) => ({ ...p, id: i + 1 })),
  };
  await save(remapped, cwd);

  // 2) .md adresáře kolizně bezpečným enginem.
  await executeRenames(join(cwd, DIR_REL.discuss), planDiscuss.renames);
  await executeRenames(join(cwd, DIR_REL.run), planRun.renames);
  await executeRenames(join(cwd, DIR_REL.memory), planMemory.renames);

  warnOrphans({ discuss: planDiscuss, run: planRun, memory: planMemory });

  log.success(`Přečíslováno ${state.phases.length} fází na 1..${state.phases.length}, sjednoceny názvy souborů.`);
  log.hint('Zkontroluj `git diff`/`git status`; případný návrat zpět: `mini undo` (stav) + git (soubory).');
  return { ok: true };
}

function printPreview(
  state: ProjectState,
  idMap: Map<number, number>,
  idChanges: ProjectState['phases'],
  plans: { phases: DirPlan; discuss: DirPlan; run: DirPlan; memory: DirPlan },
): void {
  log.info(`Přečíslování ${state.phases.length} fází (zdroj pořadí: state.json):`);
  if (idChanges.length === 0) {
    log.dim('  (id se nemění — sjednocují se jen názvy souborů)');
  } else {
    for (const p of idChanges) {
      log.dim(`  ${p.id} → ${idMap.get(p.id)}  ${p.title}`);
    }
  }
  log.info('Přejmenování souborů:');
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
    log.warn(`Orphan soubory (id není ve state.json) zůstávají beze změny: ${all.join(', ')}`);
  }
}
