import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectState } from './types.js';

const STATE_DIR = '.mini';
const STATE_FILE = 'state.json';
const STATE_PREV_FILE = 'state.prev.json';
const PROJECT_FILE = 'project.md';

function dir(cwd: string): string {
  return join(cwd, STATE_DIR);
}

export function statePath(cwd: string = process.cwd()): string {
  return join(dir(cwd), STATE_FILE);
}

export function statePrevPath(cwd: string = process.cwd()): string {
  return join(dir(cwd), STATE_PREV_FILE);
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

export async function load(cwd: string = process.cwd()): Promise<ProjectState> {
  const raw = await readFile(statePath(cwd), 'utf-8');
  return JSON.parse(raw) as ProjectState;
}

export async function loadPrev(cwd: string = process.cwd()): Promise<ProjectState> {
  const raw = await readFile(statePrevPath(cwd), 'utf-8');
  return JSON.parse(raw) as ProjectState;
}

export async function save(state: ProjectState, cwd: string = process.cwd()): Promise<void> {
  await mkdir(dir(cwd), { recursive: true });
  const target = statePath(cwd);

  let oldContent: string | null = null;
  try {
    oldContent = await readFile(target, 'utf-8');
  } catch {
    oldContent = null;
  }

  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8');
  await rename(tmp, target);

  if (oldContent !== null) {
    const prev = statePrevPath(cwd);
    const prevTmp = `${prev}.tmp`;
    try {
      await writeFile(prevTmp, oldContent, 'utf-8');
      await rename(prevTmp, prev);
    } catch {
      // backup failed; main save is still successful
    }
  }
}

export async function restorePrev(cwd: string = process.cwd()): Promise<void> {
  const target = statePath(cwd);
  const prev = statePrevPath(cwd);
  await rename(prev, target);
}

export async function readProject(cwd: string = process.cwd()): Promise<string> {
  return readFile(projectPath(cwd), 'utf-8');
}

export async function writeProject(content: string, cwd: string = process.cwd()): Promise<void> {
  await mkdir(dir(cwd), { recursive: true });
  const target = projectPath(cwd);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, target);
}

export function newState(): ProjectState {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    currentPhaseId: null,
    phases: [],
  };
}
