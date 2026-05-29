export type StepOutcome =
  | { ok: true; phaseAdvanced?: boolean; nextPhaseId?: number | null }
  | { ok: false; reason: string };

import type { BumpLevel } from '../version.js';

export interface AutoOptions {
  auto?: boolean;
  stream?: boolean;
  maxTurns?: number;
  /** Úroveň navýšení verze při finalizaci fáze (default `patch`). */
  bump?: BumpLevel;
  /** Po commitu fáze pushnout na remote (opt-in). */
  push?: boolean;
}

/** Volby finalizačních side-effectů (commit fáze): bump verze + případný push. */
export interface FinalizeOptions {
  bump?: BumpLevel;
  push?: boolean;
}
