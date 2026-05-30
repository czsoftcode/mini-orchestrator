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

/** Volný tvar starého monolitického `state.json` (verze 1). */
interface LegacyState {
  version?: number;
  createdAt?: string;
  currentPhaseId?: number | null;
  phases?: Phase[];
  model?: string;
  models?: ProjectModels;
}

/**
 * `mini migrate` — jednorázově převede starý monolitický `state.json` (verze 1)
 * na nový layout: hlavičku (lehký index + metadata) a detail každé fáze do
 * `.mini/phases/phase-<id>.json`.
 *
 * Crash-safe: nejdřív se zapíšou všechny soubory fází a teprve **nakonec**
 * hlavička (`state.json`) s `version: 2`. Dokud se hlavička nepřepíše, je projekt
 * pořád „verze 1", takže přerušená migrace se příštím během jen zopakuje.
 * Idempotentní: na už zmigrovaném stavu (verze 2) je to no-op.
 *
 * Pozn.: do budoucna sem půjde přidat i migrace `graph.md` (taky roste), zatím
 * řeší jen `state.json`.
 */
export async function migrate(cwd: string = process.cwd()): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const raw = await readFile(statePath(cwd), 'utf-8');
  let parsed: LegacyState;
  try {
    parsed = JSON.parse(raw) as LegacyState;
  } catch {
    log.error('state.json se nepodařilo přečíst (není to validní JSON).');
    return { ok: false, reason: 'invalid-json' };
  }

  if (parsed.version === SCHEMA_VERSION) {
    log.info('Stav už je v novém formátu (verze 2) — není co migrovat.');
    return { ok: true };
  }

  const phases = parsed.phases ?? [];

  // Nejdřív detail každé fáze do .mini/phases/.
  for (const phase of phases) {
    await savePhase(phase, cwd);
  }

  // Až nakonec hlavička — tím se projekt „přepne" na verzi 2.
  const header: StateHeader = {
    version: SCHEMA_VERSION,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
    currentPhaseId: parsed.currentPhaseId ?? null,
    phases: phases.map((p): PhaseSummary => ({ id: p.id, title: p.title, status: p.status })),
  };
  if (parsed.model != null) header.model = parsed.model;
  if (parsed.models != null) header.models = parsed.models;
  await saveHeader(header, cwd);

  const word = phases.length === 1 ? 'fáze' : 'fází';
  log.success(`Migrováno: ${phases.length} ${word} do ${phasesDir(cwd)}, state.json je teď hlavička (verze 2).`);
  return { ok: true };
}
