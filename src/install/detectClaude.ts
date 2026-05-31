import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

/** Where Claude Code is installed relative to the install target. */
export interface ClaudeDetection {
  /** Whether Claude Code was found at all (global or local). */
  installed: boolean;
  /** Resolvable on PATH (a global / user-wide install). */
  global: boolean;
  /** Present as a project dependency (`node_modules/.bin/claude`). */
  local: boolean;
  /** Absolute path of the global binary, when found. */
  globalPath?: string;
  /** Absolute path of the local binary, when found. */
  localPath?: string;
}

export interface DetectClaudeOptions {
  /** Project root to look for a local install in. Defaults to `process.cwd()`. */
  cwd?: string;
  /** PATH directories scanned for a global install. Defaults to `process.env.PATH`. */
  pathDirs?: string[];
  /**
   * Predicate deciding whether a path is an existing executable file. Injectable
   * for tests; defaults to a real `fs` check (exists + execute permission).
   */
  isExecutable?: (p: string) => boolean;
}

/** Real executable check: the file exists and is executable by the current user. */
function defaultIsExecutable(p: string): boolean {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function parsePathDirs(): string[] {
  const raw = process.env.PATH;
  return raw ? raw.split(delimiter).filter(Boolean) : [];
}

/**
 * Detects Claude Code: whether the `claude` CLI is installed and whether it is a
 * **global** install (resolvable on PATH) or a **local** one (the project's
 * `node_modules/.bin/claude`). Pure and synchronous so it can be unit-tested by
 * injecting `pathDirs` / `isExecutable`.
 */
export function detectClaude(options: DetectClaudeOptions = {}): ClaudeDetection {
  const cwd = options.cwd ?? process.cwd();
  const pathDirs = options.pathDirs ?? parsePathDirs();
  const isExecutable = options.isExecutable ?? defaultIsExecutable;

  const localPath = join(cwd, 'node_modules', '.bin', 'claude');
  const local = isExecutable(localPath);

  let globalPath: string | undefined;
  for (const dir of pathDirs) {
    const candidate = join(dir, 'claude');
    if (isExecutable(candidate)) {
      globalPath = candidate;
      break;
    }
  }
  const global = globalPath !== undefined;

  const detection: ClaudeDetection = {
    installed: global || local,
    global,
    local,
  };
  if (globalPath) detection.globalPath = globalPath;
  if (local) detection.localPath = localPath;
  return detection;
}

/**
 * Where to install the slash commands by default, given a detection result.
 * A local (project) install suggests project-scoped commands; otherwise the
 * user-wide home directory is the safer default (works for every project).
 */
export function recommendedScope(detection: ClaudeDetection): 'project' | 'user' {
  if (detection.local && !detection.global) return 'project';
  return 'user';
}
