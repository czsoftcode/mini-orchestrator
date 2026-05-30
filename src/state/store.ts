import { access, copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Phase, PhaseSummary, ProjectState, StateHeader } from './types.js';

const STATE_DIR = '.mini';
const STATE_FILE = 'state.json';
const STATE_PREV_FILE = 'state.prev.json';
const PHASES_DIR = 'phases';
const PHASES_PREV_DIR = 'phases-prev';
const PROJECT_FILE = 'project.md';

/** Aktuální verze schématu stavu. 1 = starý monolitický `state.json`. */
export const SCHEMA_VERSION = 2 as const;

/**
 * Stav je ve starém monolitickém formátu (version 1) a nový kód ho neumí číst.
 * Migrace je vědomá, ruční operace přes `mini migrate` — `load*` proto raději
 * spadne s jasným hintem, než aby tiše přepisovala data.
 */
export class LegacyStateError extends Error {
  constructor(public readonly foundVersion: unknown) {
    super(
      'Stav je ve starém formátu (state.json verze 1). Spusť `mini migrate`, ' +
        'který ho rozdělí do nového layoutu (.mini/phases/).',
    );
    this.name = 'LegacyStateError';
  }
}

function dir(cwd: string): string {
  return join(cwd, STATE_DIR);
}

export function statePath(cwd: string = process.cwd()): string {
  return join(dir(cwd), STATE_FILE);
}

export function statePrevPath(cwd: string = process.cwd()): string {
  return join(dir(cwd), STATE_PREV_FILE);
}

export function phasesDir(cwd: string = process.cwd()): string {
  return join(dir(cwd), PHASES_DIR);
}

function phasesPrevDir(cwd: string = process.cwd()): string {
  return join(dir(cwd), PHASES_PREV_DIR);
}

/** Název souboru fáze s nulovým paddingem kvůli čitelnému řazení v adresáři. */
export function phaseFileName(id: number): string {
  return `phase-${String(id).padStart(3, '0')}.json`;
}

export function phasePath(cwd: string, id: number): string {
  return join(phasesDir(cwd), phaseFileName(id));
}

export function projectPath(cwd: string = process.cwd()): string {
  return join(dir(cwd), PROJECT_FILE);
}

export async function exists(cwd: string = process.cwd()): Promise<boolean> {
  try {
    await access(statePath(cwd));
    return true;
  } catch {
    return false;
  }
}

export async function hasPrev(cwd: string = process.cwd()): Promise<boolean> {
  try {
    await access(statePrevPath(cwd));
    return true;
  } catch {
    return false;
  }
}

/**
 * Jednorázová migrace schématu hlavičky při čtení. Zatím řeší jen zastaralé
 * pole `model` → `models.default`: starší stavy držely jediný model v `model`,
 * dnes je vše v `models`. Když je `models.default` už nastaven, má přednost.
 * Po migraci se `model` odstraní.
 */
function migrateHeader(header: StateHeader): StateHeader {
  if (header.model != null) {
    if (!header.models) {
      header.models = {};
    }
    if (header.models.default == null) {
      header.models.default = header.model;
    }
    delete header.model;
  }
  return header;
}

async function writeJsonAtomic(target: string, data: unknown): Promise<void> {
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await rename(tmp, target);
}

async function writeRawAtomic(target: string, content: string): Promise<void> {
  const tmp = `${target}.tmp`;
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, target);
}

function toHeader(state: ProjectState): StateHeader {
  const header: StateHeader = {
    version: SCHEMA_VERSION,
    createdAt: state.createdAt,
    currentPhaseId: state.currentPhaseId,
    phases: state.phases.map((p): PhaseSummary => ({ id: p.id, title: p.title, status: p.status })),
  };
  if (state.model != null) header.model = state.model;
  if (state.models != null) header.models = state.models;
  return header;
}

/** Načte jeden soubor fáze z daného adresáře; chybějící/nevalidní → `null`. */
async function readPhaseFile(dirPath: string, id: number): Promise<Phase | null> {
  try {
    const raw = await readFile(join(dirPath, phaseFileName(id)), 'utf-8');
    return JSON.parse(raw) as Phase;
  } catch {
    return null;
  }
}

/** Sesype hlavičku + soubory fází z daného adresáře do plného `ProjectState`. */
function assembleState(header: StateHeader, phaseDirPath: string): Promise<ProjectState> {
  return (async () => {
    const phases: Phase[] = [];
    for (const summary of header.phases) {
      const detail = await readPhaseFile(phaseDirPath, summary.id);
      phases.push(detail ?? { id: summary.id, title: summary.title, status: summary.status });
    }
    const state: ProjectState = {
      version: SCHEMA_VERSION,
      createdAt: header.createdAt,
      currentPhaseId: header.currentPhaseId,
      phases,
    };
    if (header.models != null) state.models = header.models;
    return state;
  })();
}

/** Načte hlavičku stavu. Na starém formátu (version 1) vyhodí `LegacyStateError`. */
export async function loadHeader(cwd: string = process.cwd()): Promise<StateHeader> {
  const raw = await readFile(statePath(cwd), 'utf-8');
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (parsed.version !== SCHEMA_VERSION) {
    throw new LegacyStateError(parsed.version);
  }
  return migrateHeader(parsed as StateHeader);
}

export async function saveHeader(header: StateHeader, cwd: string = process.cwd()): Promise<void> {
  await mkdir(dir(cwd), { recursive: true });
  await writeJsonAtomic(statePath(cwd), header);
}

/** Načte detail jedné fáze; chybějící soubor → `null`. */
export async function loadPhase(cwd: string, id: number): Promise<Phase | null> {
  return readPhaseFile(phasesDir(cwd), id);
}

export async function savePhase(phase: Phase, cwd: string = process.cwd()): Promise<void> {
  await mkdir(phasesDir(cwd), { recursive: true });
  await writeJsonAtomic(phasePath(cwd, phase.id), phase);
}

/** Sesype hlavičku + všechny soubory fází do plného `ProjectState`. */
export async function loadFullState(cwd: string = process.cwd()): Promise<ProjectState> {
  const header = await loadHeader(cwd);
  return assembleState(header, phasesDir(cwd));
}

/** Zpětně kompatibilní načtení celého stavu (alias `loadFullState`). */
export const load = loadFullState;

/**
 * Zazálohuje aktuální stav (hlavičku i adresář fází) do prev-vrstvy pro `undo`.
 * Volá se před každým zápisem; na prvním uložení (žádný `state.json`) je no-op.
 */
async function snapshotPrev(cwd: string): Promise<void> {
  let oldHeader: string | null = null;
  try {
    oldHeader = await readFile(statePath(cwd), 'utf-8');
  } catch {
    oldHeader = null;
  }
  if (oldHeader === null) return;

  await writeRawAtomic(statePrevPath(cwd), oldHeader);

  await rm(phasesPrevDir(cwd), { recursive: true, force: true });
  await mkdir(phasesPrevDir(cwd), { recursive: true });
  let files: string[] = [];
  try {
    files = await readdir(phasesDir(cwd));
  } catch {
    files = [];
  }
  for (const f of files) {
    if (f.endsWith('.json')) {
      await copyFile(join(phasesDir(cwd), f), join(phasesPrevDir(cwd), f));
    }
  }
}

/** Smaže soubory fází, které už nejsou v aktuální sadě id (např. po `undo`). */
async function prunePhaseFiles(cwd: string, keep: Set<number>): Promise<void> {
  let files: string[] = [];
  try {
    files = await readdir(phasesDir(cwd));
  } catch {
    return;
  }
  const keepNames = new Set([...keep].map((id) => phaseFileName(id)));
  for (const f of files) {
    if (f.endsWith('.json') && !keepNames.has(f)) {
      await rm(join(phasesDir(cwd), f), { force: true });
    }
  }
}

/**
 * Zpětně kompatibilní uložení celého stavu: zazálohuje předchozí stav pro
 * `undo`, rozseká `state` na hlavičku + soubory fází a zapíše je. Granulární
 * cesty (`saveHeader`/`savePhase`) zálohu neřeší — pro undo se používá `save`.
 */
export async function save(state: ProjectState, cwd: string = process.cwd()): Promise<void> {
  await mkdir(dir(cwd), { recursive: true });
  await mkdir(phasesDir(cwd), { recursive: true });

  await snapshotPrev(cwd);

  for (const phase of state.phases) {
    await writeJsonAtomic(phasePath(cwd, phase.id), phase);
  }
  await prunePhaseFiles(cwd, new Set(state.phases.map((p) => p.id)));

  await writeJsonAtomic(statePath(cwd), toHeader(state));
}

/** Načte prev-vrstvu (hlavička + adresář fází) jako plný `ProjectState`. */
export async function loadPrev(cwd: string = process.cwd()): Promise<ProjectState> {
  const raw = await readFile(statePrevPath(cwd), 'utf-8');
  const header = migrateHeader(JSON.parse(raw) as StateHeader);
  return assembleState(header, phasesPrevDir(cwd));
}

/** Vrátí prev-vrstvu zpět jako aktuální stav (hlavičku i adresář fází). */
export async function restorePrev(cwd: string = process.cwd()): Promise<void> {
  await rename(statePrevPath(cwd), statePath(cwd));
  await rm(phasesDir(cwd), { recursive: true, force: true });
  try {
    await rename(phasesPrevDir(cwd), phasesDir(cwd));
  } catch {
    await mkdir(phasesDir(cwd), { recursive: true });
  }
}

export async function readProject(cwd: string = process.cwd()): Promise<string> {
  return readFile(projectPath(cwd), 'utf-8');
}

export async function writeProject(content: string, cwd: string = process.cwd()): Promise<void> {
  await mkdir(dir(cwd), { recursive: true });
  const target = projectPath(cwd);
  await writeRawAtomic(target, content);
}

export function newState(): ProjectState {
  return {
    version: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    currentPhaseId: null,
    phases: [],
  };
}
