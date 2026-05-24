export type StepOutcome =
  | { ok: true; phaseAdvanced?: boolean; nextPhaseId?: number | null }
  | { ok: false; reason: string };

export interface AutoOptions {
  auto?: boolean;
  stream?: boolean;
  maxTurns?: number;
}
