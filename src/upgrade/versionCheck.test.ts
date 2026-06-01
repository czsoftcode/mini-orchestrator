import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CACHE_TTL_MS,
  isCacheStale,
  isNewer,
  readCache,
  readTrigger,
  REFRESH_RETRY_MS,
  shouldRefresh,
  upgradeStatusFromCache,
  writeCache,
  writeTrigger,
} from './versionCheck.js';

describe('isNewer', () => {
  it('is true when latest is a strictly newer version', () => {
    expect(isNewer('1.9.1', '1.9.0')).toBe(true);
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('2.0.0', '1.9.9')).toBe(true);
  });
  it('is false when latest is the same or older', () => {
    expect(isNewer('1.9.0', '1.9.0')).toBe(false);
    expect(isNewer('1.8.0', '1.9.0')).toBe(false);
  });
  it('is false when a version is unparseable', () => {
    expect(isNewer('nope', '1.9.0')).toBe(false);
  });
});

describe('isCacheStale', () => {
  const now = 1_000_000_000_000;
  it('is stale when there is no cache', () => {
    expect(isCacheStale(null, CACHE_TTL_MS, now)).toBe(true);
  });
  it('is fresh within the TTL', () => {
    expect(isCacheStale({ latest: '1.9.0', checkedAt: now - 1000 }, CACHE_TTL_MS, now)).toBe(false);
  });
  it('is stale once the TTL has elapsed', () => {
    expect(isCacheStale({ latest: '1.9.0', checkedAt: now - CACHE_TTL_MS }, CACHE_TTL_MS, now)).toBe(
      true,
    );
  });
});

describe('upgradeStatusFromCache', () => {
  it('reports no upgrade when there is no cache', () => {
    expect(upgradeStatusFromCache(null, '1.9.0')).toEqual({ available: false, latest: null });
  });
  it('reports an available upgrade with the latest label', () => {
    expect(upgradeStatusFromCache({ latest: '1.9.1', checkedAt: 0 }, '1.9.0')).toEqual({
      available: true,
      latest: '1.9.1',
    });
  });
  it('reports no upgrade but keeps the latest label when current', () => {
    expect(upgradeStatusFromCache({ latest: '1.9.0', checkedAt: 0 }, '1.9.0')).toEqual({
      available: false,
      latest: '1.9.0',
    });
  });
});

describe('shouldRefresh', () => {
  const now = 1_000_000_000_000;
  const fresh = { latest: '1.9.0', checkedAt: now - 1000 }; // within TTL
  const stale = { latest: '1.9.0', checkedAt: now - CACHE_TTL_MS }; // past TTL

  it('refreshes on a brand-new session even when the cache is fresh', () => {
    const trigger = { sessionId: 'old-session', triggeredAt: now - 1000 };
    expect(shouldRefresh(fresh, trigger, 'new-session', now)).toBe(true);
  });

  it('refreshes when there is no trigger marker yet and a session id is present', () => {
    expect(shouldRefresh(fresh, null, 'sess-1', now)).toBe(true);
  });

  it('does not refresh within the same session while the cache is fresh', () => {
    const trigger = { sessionId: 'sess-1', triggeredAt: now - 1000 };
    expect(shouldRefresh(fresh, trigger, 'sess-1', now)).toBe(false);
  });

  it('refreshes within the same session once the cache is stale (long session)', () => {
    const trigger = { sessionId: 'sess-1', triggeredAt: now - REFRESH_RETRY_MS };
    expect(shouldRefresh(stale, trigger, 'sess-1', now)).toBe(true);
  });

  it('rate-limits the stale path: no refresh within the retry cooldown', () => {
    const trigger = { sessionId: 'sess-1', triggeredAt: now - 1000 };
    expect(shouldRefresh(stale, trigger, 'sess-1', now)).toBe(false);
  });

  it('without a session id falls back to TTL behaviour (stale → refresh)', () => {
    expect(shouldRefresh(stale, null, undefined, now)).toBe(true);
    expect(shouldRefresh(fresh, null, undefined, now)).toBe(false);
  });
});

describe('readTrigger / writeTrigger', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mini-rt-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips a written marker', async () => {
    const path = join(dir, 'refresh.json');
    await writeTrigger('sess-1', path, 555);
    expect(await readTrigger(path)).toEqual({ sessionId: 'sess-1', triggeredAt: 555 });
  });

  it('returns null for a missing file', async () => {
    expect(await readTrigger(join(dir, 'missing.json'))).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    const path = join(dir, 'bad.json');
    await writeFile(path, 'nope', 'utf-8');
    expect(await readTrigger(path)).toBeNull();
  });
});

describe('readCache / writeCache', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mini-vc-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips a written cache', async () => {
    const path = join(dir, 'cache.json');
    await writeCache('1.9.1', path, 123);
    expect(await readCache(path)).toEqual({ latest: '1.9.1', checkedAt: 123 });
  });

  it('returns null for a missing file', async () => {
    expect(await readCache(join(dir, 'missing.json'))).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    const path = join(dir, 'bad.json');
    await writeFile(path, '{not json', 'utf-8');
    expect(await readCache(path)).toBeNull();
  });

  it('returns null when fields are missing', async () => {
    const path = join(dir, 'partial.json');
    await writeFile(path, JSON.stringify({ latest: '1.9.1' }), 'utf-8');
    expect(await readCache(path)).toBeNull();
  });
});
