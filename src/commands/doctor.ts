import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import pc from 'picocolors';
import { CHANGELOG_FILE } from '../changelog.js';
import { COMMAND_DEFS, COMMANDS_DIR } from '../install/commands.js';
import { RUN_DIR } from '../state/runReport.js';
import {
  SCHEMA_VERSION,
  exists,
  load,
  phaseStem,
  projectPath,
  statePath,
} from '../state/store.js';
import type { Phase } from '../state/types.js';
import { log } from '../ui/log.js';
import { isNewer, readCache } from '../upgrade/versionCheck.js';
import { readPackageVersion } from '../version.js';
import { isOrphanedDoing } from './status.js';

export type DoctorStatus = 'ok' | 'warn' | 'fail';

/** One line of the `mini doctor` checklist. */
export interface DoctorCheck {
  label: string;
  status: DoctorStatus;
  /** Short factual detail shown after the label. */
  detail?: string;
  /** A fix suggestion, shown when the check isn't `ok`. */
  hint?: string;
}

/** Facts the command gathers from the filesystem / environment. */
export interface DoctorInput {
  /** Does `.mini/state.json` exist? */
  projectExists: boolean;
  /** Schema version read from `state.json`, or `null` when missing/unreadable. */
  schemaVersion: number | null;
  /** The schema version this mini build expects. */
  expectedSchema: number;
  hasProjectMd: boolean;
  hasChangelog: boolean;
  /**
   * Ids of phases stuck in `doing` with no open work left (orphaned) — should be
   * closed via `mini done`. Empty when the project is healthy or has no phases.
   */
  orphanedDoingPhases: number[];
  /**
   * Filenames of run reports in `.mini/run/` whose phase no longer exists in the
   * state (stale leftovers, e.g. after `mini undo` / `migrate --renumber`).
   */
  staleRunReports: string[];
  /** Number of `*.md` slash commands installed in the project scope. */
  installedCommands: number;
  /** Number of slash commands this mini build ships. */
  expectedCommands: number;
  currentVersion: string;
  /** Latest published version from the cache, or `null` when unknown. */
  latestVersion: string | null;
}

/**
 * Turns the gathered facts into an ordered checklist. Pure (no I/O) so it is
 * fully unit-testable; the `doctor` command only gathers the input and prints.
 */
export function buildDiagnostics(input: DoctorInput): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  // Project state.
  if (!input.projectExists) {
    checks.push({
      label: 'Project',
      status: 'fail',
      detail: 'no .mini project here',
      hint: 'Run `mini init` to start one',
    });
  } else if (input.schemaVersion !== input.expectedSchema) {
    checks.push({
      label: 'Project',
      status: 'fail',
      detail: `state.json schema v${input.schemaVersion ?? '?'} (expected v${input.expectedSchema})`,
      hint: 'Run `mini migrate` to upgrade the state layout',
    });
  } else {
    checks.push({ label: 'Project', status: 'ok', detail: `state schema v${input.schemaVersion}` });
  }

  // Phase hygiene — only meaningful for an existing project.
  if (input.projectExists) {
    // Orphaned `doing` phases: stuck in "doing" with no open work left.
    if (input.orphanedDoingPhases.length > 0) {
      const ids = input.orphanedDoingPhases.join(', ');
      checks.push({
        label: 'Phases',
        status: 'warn',
        detail: `phase ${ids} stuck in "doing" with no open work`,
        hint: 'Close it via `mini done` (or `mini undo` to step back)',
      });
    } else {
      checks.push({ label: 'Phases', status: 'ok', detail: 'no orphaned "doing" phases' });
    }

    // Stale run reports: report files with no matching phase in the state.
    if (input.staleRunReports.length > 0) {
      const names = input.staleRunReports.join(', ');
      checks.push({
        label: 'Run reports',
        status: 'warn',
        detail: `${input.staleRunReports.length} stale (${names})`,
        hint: 'Leftover reports with no phase — safe to delete from `.mini/run/`',
      });
    } else {
      checks.push({ label: 'Run reports', status: 'ok', detail: 'no stale reports' });
    }
  }

  // project.md.
  checks.push(
    input.hasProjectMd
      ? { label: 'project.md', status: 'ok', detail: 'present' }
      : {
          label: 'project.md',
          status: 'warn',
          detail: 'missing',
          hint: 'The project summary for Claude — `mini init` writes it',
        },
  );

  // CHANGELOG.md.
  checks.push(
    input.hasChangelog
      ? { label: 'CHANGELOG.md', status: 'ok', detail: 'present' }
      : {
          label: 'CHANGELOG.md',
          status: 'warn',
          detail: 'missing',
          hint: '`mini done` folds release notes here — create one to track changes',
        },
  );

  // Slash commands (project scope).
  if (input.installedCommands === 0) {
    checks.push({
      label: 'Slash commands',
      status: 'warn',
      detail: 'none installed in this project',
      hint: 'Run `mini install-commands` (or rely on the user-scope ones)',
    });
  } else if (input.installedCommands < input.expectedCommands) {
    checks.push({
      label: 'Slash commands',
      status: 'warn',
      detail: `${input.installedCommands}/${input.expectedCommands} installed (outdated)`,
      hint: 'Run `mini install-commands` to refresh them',
    });
  } else {
    checks.push({
      label: 'Slash commands',
      status: 'ok',
      detail: `${input.installedCommands} installed`,
    });
  }

  // Version freshness.
  if (input.latestVersion === null) {
    checks.push({
      label: 'Version',
      status: 'ok',
      detail: `v${input.currentVersion} (latest unknown)`,
      hint: 'Run `mini upgrade --check` for a fresh check',
    });
  } else if (isNewer(input.latestVersion, input.currentVersion)) {
    checks.push({
      label: 'Version',
      status: 'warn',
      detail: `v${input.currentVersion} → v${input.latestVersion} available`,
      hint: 'Run `mini upgrade` to update',
    });
  } else {
    checks.push({ label: 'Version', status: 'ok', detail: `v${input.currentVersion} (up to date)` });
  }

  return checks;
}

/**
 * Picks the stale run reports out of a `.mini/run/` directory listing: report
 * files (`phase-<id>.md`, not the transient `.prev.md` backups) whose `<id>`
 * matches no phase in the state. Pure, so it is unit-testable. Returned sorted
 * for a stable checklist.
 */
export function findStaleRunReports(runDirFiles: string[], phases: readonly Phase[]): string[] {
  const valid = new Set(phases.map((p) => `${phaseStem(p.id)}.md`));
  return runDirFiles
    .filter((f) => /^phase-\d+(?:\.\d+)?\.md$/.test(f) && !valid.has(f))
    .sort();
}

/** Lists the `.mini/run/` directory, returning `[]` when it doesn't exist. */
async function listRunDir(cwd: string): Promise<string[]> {
  try {
    return await readdir(join(cwd, RUN_DIR));
  } catch {
    return [];
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Reads the `version` field from `state.json`, or `null` when missing/unreadable. */
async function readSchemaVersion(cwd: string): Promise<number | null> {
  try {
    const raw = JSON.parse(await readFile(statePath(cwd), 'utf-8')) as { version?: unknown };
    return typeof raw.version === 'number' ? raw.version : null;
  } catch {
    return null;
  }
}

/** Counts the installed `*.md` slash commands in the project scope. */
async function countInstalledCommands(cwd: string): Promise<number> {
  try {
    const files = await readdir(join(cwd, COMMANDS_DIR));
    return files.filter((f) => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

const STATUS_RENDER: Record<DoctorStatus, { symbol: string; color: (s: string) => string }> = {
  ok: { symbol: '✓', color: pc.green },
  warn: { symbol: '!', color: pc.yellow },
  fail: { symbol: '✗', color: pc.red },
};

/**
 * `mini doctor` — a quick health check of the project setup. Read-only: gathers
 * facts from the filesystem and the version cache and prints a checklist with a
 * fix hint for anything that isn't `ok`.
 */
export async function doctor(): Promise<void> {
  const cwd = process.cwd();

  const [projectExists, hasProjectMd, hasChangelog, installedCommands, runDirFiles, cache] =
    await Promise.all([
      exists(cwd),
      fileExists(projectPath(cwd)),
      fileExists(join(cwd, CHANGELOG_FILE)),
      countInstalledCommands(cwd),
      listRunDir(cwd),
      readCache(),
    ]);

  // Phase-level hygiene needs the full state (steps live in per-phase files).
  let orphanedDoingPhases: number[] = [];
  let staleRunReports: string[] = [];
  if (projectExists) {
    const state = await load(cwd);
    orphanedDoingPhases = state.phases
      .filter((p) => isOrphanedDoing(p, state.phases))
      .map((p) => p.id);
    staleRunReports = findStaleRunReports(runDirFiles, state.phases);
  }

  const checks = buildDiagnostics({
    projectExists,
    schemaVersion: projectExists ? await readSchemaVersion(cwd) : null,
    expectedSchema: SCHEMA_VERSION,
    hasProjectMd,
    hasChangelog,
    orphanedDoingPhases,
    staleRunReports,
    installedCommands,
    expectedCommands: COMMAND_DEFS.length,
    currentVersion: readPackageVersion(),
    latestVersion: cache?.latest ?? null,
  });

  log.title('mini doctor');
  for (const c of checks) {
    const r = STATUS_RENDER[c.status];
    const detail = c.detail ? `: ${c.detail}` : '';
    log.info(`  ${r.color(r.symbol)} ${c.label}${detail}`);
    if (c.status !== 'ok' && c.hint) {
      log.hint(`  ${c.hint}`);
    }
  }

  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  console.log();
  if (fails > 0) {
    log.warn(`${fails} problem${fails === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'}.`);
  } else if (warns > 0) {
    log.warn(`All essentials present, ${warns} warning${warns === 1 ? '' : 's'}.`);
  } else {
    log.success('Everything looks healthy.');
  }
}
