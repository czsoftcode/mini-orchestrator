import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { emptyTreeSha } from './git.js';
import { resolveRange } from './range.js';
import { savePhase } from './state/store.js';
import type { Phase } from './state/types.js';

const execFileAsync = promisify(execFile);

async function initRepo(cwd: string): Promise<void> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'mini-test@example.com'], { cwd });
  await execFileAsync('git', ['config', 'user.name', 'Mini Test'], { cwd });
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
}

/** Creates a commit touching a uniquely named file and returns its full SHA. */
async function commit(cwd: string, name: string): Promise<string> {
  await writeFile(join(cwd, name), `${name}\n`);
  await execFileAsync('git', ['add', '-A'], { cwd });
  await execFileAsync('git', ['commit', '-m', name], { cwd });
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd });
  return stdout.trim();
}

/** Saves a minimal phase file, optionally with a recorded `preSha`. */
async function savePhaseWith(cwd: string, id: number, preSha?: string): Promise<void> {
  const phase: Phase = { id, title: `P${id}`, status: 'done' };
  if (preSha) phase.autoCommit = { preSha, subject: `Phase ${id}` };
  await savePhase(phase, cwd);
}

describe('resolveRange', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-range-'));
    await initRepo(cwd);
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  describe('input validation (no git/loadPhase)', () => {
    it('rejects mixing phase flags with ref flags', async () => {
      const r = await resolveRange(cwd, { fromPhase: 1, to: 'HEAD' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/mix/i);
    });

    it('rejects an empty input (no range given)', async () => {
      const r = await resolveRange(cwd, {});
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/no range/i);
    });

    it('rejects a phase range missing one bound', async () => {
      const r = await resolveRange(cwd, { fromPhase: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/both --from-phase and --to-phase/i);
    });

    it('rejects a ref range missing one bound', async () => {
      const r = await resolveRange(cwd, { from: 'HEAD' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/both --from and --to/i);
    });

    it('treats a blank ref string as not given', async () => {
      const r = await resolveRange(cwd, { from: '   ', to: 'HEAD' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/both --from and --to/i);
    });

    it('rejects an inverted phase range', async () => {
      const r = await resolveRange(cwd, { fromPhase: 3, toPhase: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/inverted/i);
    });
  });

  describe('phase mode', () => {
    it('resolves N..M to preSha(N)..preSha(M+1) when M is not last', async () => {
      const c1 = await commit(cwd, 'a');
      const c2 = await commit(cwd, 'b');
      const c3 = await commit(cwd, 'c');
      await savePhaseWith(cwd, 1, c1);
      await savePhaseWith(cwd, 2, c2);
      await savePhaseWith(cwd, 3, c3);

      const r = await resolveRange(cwd, { fromPhase: 1, toPhase: 2 });
      expect(r).toEqual({ ok: true, fromSha: c1, toSha: c3 });
    });

    it('uses current HEAD as toSha when M is the last phase', async () => {
      const c1 = await commit(cwd, 'a');
      const c2 = await commit(cwd, 'b');
      const head = await commit(cwd, 'c'); // extra commit after the last phase
      await savePhaseWith(cwd, 1, c1);
      await savePhaseWith(cwd, 2, c2);

      const r = await resolveRange(cwd, { fromPhase: 1, toPhase: 2 });
      expect(r).toEqual({ ok: true, fromSha: c1, toSha: head });
    });

    it('hard-fails when the start phase does not exist', async () => {
      await commit(cwd, 'a');
      const r = await resolveRange(cwd, { fromPhase: 99, toPhase: 100 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Phase 99 not found/);
    });

    it('hard-fails when a non-first start phase has no recorded preSha', async () => {
      const c1 = await commit(cwd, 'a');
      await commit(cwd, 'b');
      await savePhaseWith(cwd, 4, c1); // a lower phase exists → 5 is not the first
      await savePhaseWith(cwd, 5); // no preSha, and not the project's first phase
      const r = await resolveRange(cwd, { fromPhase: 5, toPhase: 5 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Phase 5 has no recorded pre-commit SHA/);
    });

    it('uses the empty tree as fromSha when the first phase has no preSha (genesis)', async () => {
      await commit(cwd, 'a');
      const c2 = await commit(cwd, 'b');
      await savePhaseWith(cwd, 1); // project's first phase, NO preSha
      await savePhaseWith(cwd, 2, c2); // preSha(2) becomes toSha for range [1..1]
      const r = await resolveRange(cwd, { fromPhase: 1, toPhase: 1 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.fromSha).toBe(await emptyTreeSha(cwd));
        expect(r.toSha).toBe(c2);
      }
    });

    it('hard-fails when phase M+1 exists but has no recorded preSha', async () => {
      const c1 = await commit(cwd, 'a');
      await commit(cwd, 'b');
      await savePhaseWith(cwd, 1, c1);
      await savePhaseWith(cwd, 2); // exists, but no preSha
      const r = await resolveRange(cwd, { fromPhase: 1, toPhase: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Phase 2 has no recorded pre-commit SHA/);
    });

    it('rejects an empty range when both phase bounds resolve to the same commit', async () => {
      const c1 = await commit(cwd, 'a');
      await savePhaseWith(cwd, 1, c1);
      await savePhaseWith(cwd, 2, c1); // preSha(M+1) == preSha(N)
      const r = await resolveRange(cwd, { fromPhase: 1, toPhase: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/empty range/i);
    });
  });

  describe('ref mode', () => {
    it('resolves plain refs to full commit SHAs', async () => {
      const c1 = await commit(cwd, 'a');
      const c2 = await commit(cwd, 'b');
      const r = await resolveRange(cwd, { from: 'HEAD~1', to: 'HEAD' });
      expect(r).toEqual({ ok: true, fromSha: c1, toSha: c2 });
    });

    it('hard-fails on an invalid/unknown ref', async () => {
      await commit(cwd, 'a');
      const r = await resolveRange(cwd, { from: 'no-such-ref', to: 'HEAD' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Invalid git ref: no-such-ref/);
    });

    it('rejects an empty range when both refs resolve to the same commit', async () => {
      await commit(cwd, 'a');
      const r = await resolveRange(cwd, { from: 'HEAD', to: 'HEAD' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/empty range/i);
    });
  });
});
