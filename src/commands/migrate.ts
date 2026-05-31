import { readFile } from 'node:fs/promises';
import {
  exists,
  phasesDir,
  saveHeader,
  savePhase,
  SCHEMA_VERSION,
  statePath,
} from '../state/store.js';
import type { Phase, PhaseSummary, ProjectModels, StateHeader } from '../state/types.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

/** Loose shape of the old monolithic `state.json` (version 1). */
interface LegacyState {
  version?: number;
  createdAt?: string;
  currentPhaseId?: number | null;
  phases?: Phase[];
  model?: string;
  models?: ProjectModels;
}

/**
 * `mini migrate` — one-off conversion of the old monolithic `state.json` (version 1)
 * to the new layout: a header (a lightweight index + metadata) and the detail of
 * each phase into `.mini/phases/phase-<id>.json`.
 *
 * Crash-safe: first all phase files are written and only **at the end** the
 * header (`state.json`) with `version: 2`. Until the header is rewritten, the
 * project is still "version 1", so an interrupted migration just repeats on the
 * next run. Idempotent: on an already migrated state (version 2) it is a no-op.
 *
 * Note: in the future a `graph.md` migration could go here too (it also grows);
 * for now it only handles `state.json`.
 */
export async function migrate(cwd: string = process.cwd()): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('There is no project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const raw = await readFile(statePath(cwd), 'utf-8');
  let parsed: LegacyState;
  try {
    parsed = JSON.parse(raw) as LegacyState;
  } catch {
    log.error('Failed to read state.json (not valid JSON).');
    return { ok: false, reason: 'invalid-json' };
  }

  if (parsed.version === SCHEMA_VERSION) {
    log.info('The state is already in the new format (version 2) — nothing to migrate.');
    return { ok: true };
  }

  const phases = parsed.phases ?? [];

  // First the detail of each phase into .mini/phases/.
  for (const phase of phases) {
    await savePhase(phase, cwd);
  }

  // The header last — this "switches" the project to version 2.
  const header: StateHeader = {
    version: SCHEMA_VERSION,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
    currentPhaseId: parsed.currentPhaseId ?? null,
    phases: phases.map((p): PhaseSummary => ({ id: p.id, title: p.title, status: p.status })),
  };
  if (parsed.model != null) header.model = parsed.model;
  if (parsed.models != null) header.models = parsed.models;
  await saveHeader(header, cwd);

  const word = phases.length === 1 ? 'phase' : 'phases';
  log.success(`Migrated: ${phases.length} ${word} into ${phasesDir(cwd)}, state.json is now a header (version 2).`);
  return { ok: true };
}
