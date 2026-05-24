export type StepStatus = 'todo' | 'doing' | 'done' | 'skipped';

export type PhaseStatus = 'proposed' | 'planned' | 'doing' | 'done' | 'skipped';

export interface Step {
  title: string;
  status: StepStatus;
  notes?: string;
}

export interface Phase {
  id: number;
  title: string;
  goal?: string;
  status: PhaseStatus;
  steps?: Step[];
  humanNotes?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ProjectModels {
  default?: string;
  next?: string;
  plan?: string;
  do?: string;
  importGsd?: string;
  audit?: string;
}

export interface ProjectState {
  version: 1;
  createdAt: string;
  currentPhaseId: number | null;
  phases: Phase[];
  /** @deprecated use `models.default` */
  model?: string;
  models?: ProjectModels;
}
