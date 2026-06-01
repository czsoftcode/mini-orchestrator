/**
 * `mini statusline` — the command Claude Code runs to render its status line.
 *
 * Claude Code pipes the status JSON on stdin and shows whatever the command
 * prints on stdout. This wrapper does the IO (read stdin, read the transcript
 * file) and delegates the actual logic to the pure `src/statusline/` module.
 *
 * Deliberately lean: it imports only the statusline module and Node builtins, no
 * heavy CLI/graph dependencies, because Claude Code re-runs it on every refresh
 * and a slow startup would be visible. It also never throws — a status line that
 * errors would just clutter the UI — so on any failure it prints nothing.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { buildData, type StatusInput } from '../statusline/statusline.js';
import { renderStatusline } from '../statusline/render.js';
import { isCacheStale, readCache, upgradeStatusFromCache } from '../upgrade/versionCheck.js';
import { readPackageVersion } from '../version.js';

/** Reads all of stdin as a UTF-8 string. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * The latest mini version to advertise, read from the cache ONLY (never the
 * network — the status line must return instantly). When the cache is missing or
 * older than the TTL, it fires a detached `mini check-version` to refresh it for
 * next time and returns `null` for now. Any failure → `null` (no segment).
 */
async function readUpgradeLabel(): Promise<string | null> {
  try {
    const cache = await readCache();
    if (isCacheStale(cache)) fireBackgroundRefresh();
    const { available, latest } = upgradeStatusFromCache(cache, readPackageVersion());
    return available ? latest : null;
  } catch {
    return null;
  }
}

/**
 * Spawns a fully detached `mini check-version` that refreshes the version cache
 * in the background. stdio is ignored and the child is `unref`-ed so it never
 * holds up the status-line process. Re-runs this same CLI entry (`process.argv[1]`)
 * so it works the same whether invoked from source or the built bin. Failures
 * are swallowed — a refresh is best-effort.
 */
function fireBackgroundRefresh(): void {
  try {
    const entry = process.argv[1];
    if (!entry) return;
    const child = spawn(process.execPath, [entry, 'check-version'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // best-effort — ignore
  }
}

export async function statusline(): Promise<void> {
  try {
    const raw = await readStdin();
    const input = JSON.parse(raw) as StatusInput;

    let transcript = '';
    if (input.transcript_path) {
      transcript = await readFile(input.transcript_path, 'utf-8').catch(() => '');
    }

    const upgrade = await readUpgradeLabel();
    const line = renderStatusline(buildData(input, transcript, upgrade));
    if (line) process.stdout.write(line);
  } catch {
    // A status line must never fail loudly — print nothing and exit cleanly.
  }
}

/**
 * `mini check-version` — fetches the latest published version from npm and
 * writes it to the version cache. Run detached by the status line; also usable
 * by hand. Hidden, best-effort, and never throws.
 */
export async function checkVersion(): Promise<void> {
  try {
    const { refreshCache } = await import('../upgrade/versionCheck.js');
    await refreshCache();
  } catch {
    // best-effort — ignore
  }
}
