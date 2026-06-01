/**
 * Latest-version check for the published `mini-orchestrator` npm package.
 *
 * Two consumers with different needs share this module:
 * - `mini upgrade` does a fresh, synchronous fetch (it is about to install),
 * - the status line must NEVER block on the network — it only reads a small TTL
 *   cache and fires a detached background refresh when that cache is stale.
 *
 * So the network call (`fetchLatestVersion`) and the cache (`readCache` /
 * `writeCache` / `isCacheStale`) are kept separate, and the pure decision
 * (`upgradeStatusFromCache`) is testable without any IO. Everything here is
 * dependency-light (Node builtins + `version.ts`) so it stays cheap to import
 * from the lean status-line path.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compareSemver } from '../version.js';

/** The published package name on npm (also the registry key). */
export const PACKAGE_NAME = 'mini-orchestrator';

/** How long a cached latest-version reading stays fresh: 5 hours. */
export const CACHE_TTL_MS = 5 * 60 * 60 * 1000;

/** npm registry endpoint that returns the metadata of the `latest` dist-tag. */
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

/** The shape persisted in the cache file. */
export interface VersionCache {
  /** The latest published version known at `checkedAt`. */
  latest: string;
  /** Epoch milliseconds when the registry was last queried. */
  checkedAt: number;
}

/** Path of the cache file (in the OS temp dir, keyed to the package name). */
export function cacheFilePath(dir: string = tmpdir()): string {
  return join(dir, `${PACKAGE_NAME}-version.json`);
}

/**
 * Reads the version cache. Returns `null` when the file is missing or malformed
 * — the caller then treats it as "no reading yet" (stale). Never throws.
 */
export async function readCache(path: string = cacheFilePath()): Promise<VersionCache | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<VersionCache>;
    if (typeof parsed.latest === 'string' && typeof parsed.checkedAt === 'number') {
      return { latest: parsed.latest, checkedAt: parsed.checkedAt };
    }
  } catch {
    // missing / unreadable / invalid JSON → behave as if there is no cache
  }
  return null;
}

/** Writes the latest version into the cache with the current timestamp. */
export async function writeCache(
  latest: string,
  path: string = cacheFilePath(),
  now: number = Date.now(),
): Promise<void> {
  const data: VersionCache = { latest, checkedAt: now };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data), 'utf-8');
}

/** A cache is stale (needs a refresh) when it is missing or older than the TTL. */
export function isCacheStale(
  cache: VersionCache | null,
  ttl: number = CACHE_TTL_MS,
  now: number = Date.now(),
): boolean {
  if (!cache) return true;
  return now - cache.checkedAt >= ttl;
}

/**
 * Fetches the latest published version from the npm registry. Returns `null` on
 * any failure (offline, non-200, malformed body) — callers degrade gracefully.
 */
export async function fetchLatestVersion(url: string = REGISTRY_URL): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === 'string' && body.version.length > 0 ? body.version : null;
  } catch {
    return null;
  }
}

/**
 * Fetches the latest version and persists it to the cache. Returns the version,
 * or `null` when the fetch failed (in which case the cache is left untouched).
 * This is what the detached background refresh and `mini upgrade` both run.
 */
export async function refreshCache(path: string = cacheFilePath()): Promise<string | null> {
  const latest = await fetchLatestVersion();
  if (latest) await writeCache(latest, path);
  return latest;
}

/** True when `latest` is a strictly newer `x.y.z` version than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const cmp = compareSemver(latest, current);
  return cmp !== null && cmp > 0;
}

/** Whether an upgrade is available, plus the latest version (for the label). */
export interface UpgradeStatus {
  available: boolean;
  latest: string | null;
}

/**
 * Pure upgrade decision from a cache reading + the currently installed version.
 * Used by the status line, which only ever reads the cache (never the network).
 */
export function upgradeStatusFromCache(
  cache: VersionCache | null,
  current: string,
): UpgradeStatus {
  if (!cache) return { available: false, latest: null };
  return { available: isNewer(cache.latest, current), latest: cache.latest };
}
