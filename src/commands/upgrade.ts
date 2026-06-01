/**
 * `mini upgrade` — checks npm for a newer published version and installs it.
 *
 * The pure decision (`decideUpgrade`) and the install-kind classification
 * (`classifyInstall`) are split out from the IO so they can be unit-tested; the
 * `upgrade` entry point only wires them to the registry fetch, the prompt and
 * `npm install -g`. Unlike the status line, this command does a fresh, blocking
 * fetch — it is about to install, so a stale cache would be wrong.
 */

import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { promisify } from 'node:util';
import { ask } from '../ui/ask.js';
import { isInteractive } from '../ui/interactive.js';
import { log } from '../ui/log.js';
import { fetchLatestVersion, isNewer, PACKAGE_NAME, writeCache } from '../upgrade/versionCheck.js';
import { readPackageVersion } from '../version.js';
import type { StepOutcome } from './types.js';

const execFileAsync = promisify(execFile);

/** Outcome of comparing the installed version with the latest on npm. */
export type UpgradeDecision = 'unknown' | 'up-to-date' | 'available';

/**
 * Pure decision from the current and latest versions. `latest === null` means
 * the lookup failed (offline / registry error) → `unknown`.
 */
export function decideUpgrade(current: string, latest: string | null): UpgradeDecision {
  if (!latest) return 'unknown';
  return isNewer(latest, current) ? 'available' : 'up-to-date';
}

/** How mini is installed, inferred from its CLI entry path. */
export type InstallKind = 'npm' | 'dev';

/**
 * Classifies the install from the CLI entry path:
 * - `npm` — a global npm install (path under `node_modules/mini-orchestrator/`),
 *   upgradable via `npm install -g`;
 * - `dev` — a local dev build (the `install-local` layout under
 *   `share/mini/versions/`, or running straight from `src/cli.{ts,js}`), which
 *   npm cannot upgrade.
 *
 * Unknown layouts default to `npm`: we attempt the documented upgrade and let
 * npm print a clear error if the package isn't actually installed globally.
 */
export function classifyInstall(entryPath: string): InstallKind {
  const p = entryPath.replace(/\\/g, '/');
  if (p.includes('/node_modules/mini-orchestrator/')) return 'npm';
  if (p.includes('/share/mini/versions/') || p.endsWith('/src/cli.ts') || p.endsWith('/src/cli.js')) {
    return 'dev';
  }
  return 'npm';
}

/** Resolves the real CLI entry path (follows symlinks); falls back to argv[1]. */
function resolveEntry(): string {
  const entry = process.argv[1] ?? '';
  try {
    return realpathSync(entry);
  } catch {
    return entry;
  }
}

export interface UpgradeOptions {
  /** Only check and report the latest version; never install. */
  check?: boolean;
  /** Skip the confirmation prompt and install directly (non-interactive). */
  yes?: boolean;
}

/**
 * Runs the upgrade flow: fresh check → report current/latest → (optionally)
 * confirm → `npm install -g mini-orchestrator@latest`. Returns `ok: true` for
 * the benign outcomes (already current, check-only, user declined) and
 * `ok: false` only for genuine failures (registry unreachable, dev install,
 * npm error). Also refreshes the status-line cache as a side effect.
 */
export async function upgrade({ check = false, yes = false }: UpgradeOptions = {}): Promise<StepOutcome> {
  const current = readPackageVersion();
  log.title('mini upgrade');
  log.info(`Current version: ${current}`);

  const latest = await fetchLatestVersion();
  if (latest) await writeCache(latest); // keep the status-line cache fresh too

  const decision = decideUpgrade(current, latest);
  if (decision === 'unknown') {
    log.warn('Could not reach the npm registry to check for a newer version.');
    log.hint('Check your connection, or upgrade manually: npm install -g mini-orchestrator@latest');
    return { ok: false, reason: 'registry-unreachable' };
  }

  log.info(`Latest on npm:   ${latest}`);

  if (decision === 'up-to-date') {
    log.success('You are on the latest version — nothing to upgrade.');
    return { ok: true };
  }

  // decision === 'available'
  log.success(`A newer version is available: ${current} → ${latest}`);
  if (check) {
    log.hint('Run `mini upgrade` (without --check) to install it.');
    return { ok: true };
  }

  const kind = classifyInstall(resolveEntry());
  if (kind === 'dev') {
    log.warn('This looks like a local dev build, not a global npm install — skipping automatic upgrade.');
    log.hint('Update it from the repo instead: git pull && npm run install-local');
    return { ok: false, reason: 'dev-install' };
  }

  if (!yes) {
    if (!isInteractive()) {
      log.hint('Re-run with --yes to install, or upgrade manually: npm install -g mini-orchestrator@latest');
      return { ok: true };
    }
    const res = await ask({
      type: 'confirm',
      name: 'ok',
      message: `Install ${PACKAGE_NAME}@${latest} now (npm install -g)?`,
      initial: true,
    });
    if ((res as { ok?: boolean }).ok !== true) {
      log.hint('Skipped. You can upgrade later with `mini upgrade`.');
      return { ok: true };
    }
  }

  log.info(`Installing ${PACKAGE_NAME}@latest …`);
  try {
    const { stdout, stderr } = await execFileAsync('npm', ['install', '-g', `${PACKAGE_NAME}@latest`]);
    const out = `${stdout}\n${stderr}`.trim();
    if (out) log.dim(out);
    log.success(`Upgraded to ${latest}.`);
    return { ok: true };
  } catch (err) {
    const e = err as { stderr?: string | Buffer; message?: string };
    log.error('npm install failed.');
    const detail = (e.stderr ? e.stderr.toString() : e.message ?? '').trim();
    if (detail) log.dim(detail);
    log.hint('Upgrade manually: npm install -g mini-orchestrator@latest');
    return { ok: false, reason: 'npm-failed' };
  }
}
