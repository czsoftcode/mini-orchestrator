import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, writeProject } from '../state/store.js';
import { decisionExists, readDecision } from '../state/decisionStore.js';
import type { ProjectState } from '../state/types.js';
import { applyDecision } from './decision.js';

function stateWithCurrentPhase(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: 4,
    phases: [
      { id: 4, title: 'A phase', goal: 'do a thing', status: 'doing', steps: [] },
    ],
  };
}

const BODY = '# Warn, not error\n\n## Decision\nUse a warn.\n\n## Why\nLegit state.';

describe('applyDecision', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-decision-cmd-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('writes the ADR for the current phase', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithCurrentPhase(), cwd);

    const r = await applyDecision(BODY, cwd);
    expect(r.ok).toBe(true);
    expect(await decisionExists(cwd, 4)).toBe(true);
    expect(await readDecision(cwd, 4)).toBe(BODY);
  });

  it('errors with no project (writes nothing)', async () => {
    const r = await applyDecision(BODY, cwd);
    expect(r).toEqual({ ok: false, reason: 'no-project' });
  });

  it('errors when there is no current phase', async () => {
    await writeProject('# Project', cwd);
    const state = stateWithCurrentPhase();
    state.currentPhaseId = null;
    await save(state, cwd);

    const r = await applyDecision(BODY, cwd);
    expect(r).toEqual({ ok: false, reason: 'no-current-phase' });
  });

  it('refuses a phase that is already done (writes nothing)', async () => {
    await writeProject('# Project', cwd);
    const state = stateWithCurrentPhase();
    state.phases[0]!.status = 'done';
    await save(state, cwd);

    const r = await applyDecision(BODY, cwd);
    expect(r).toEqual({ ok: false, reason: 'phase-not-active' });
    expect(await decisionExists(cwd, 4)).toBe(false);
  });

  it('surfaces an empty body as decision-empty (writes nothing)', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithCurrentPhase(), cwd);

    const r = await applyDecision('   \n\t\n', cwd);
    expect(r).toEqual({ ok: false, reason: 'decision-empty' });
    expect(await decisionExists(cwd, 4)).toBe(false);
  });

  it('surfaces a heading-less body as decision-no-heading (writes nothing)', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithCurrentPhase(), cwd);

    const r = await applyDecision('## Decision\nfoo', cwd);
    expect(r).toEqual({ ok: false, reason: 'decision-no-heading' });
    expect(await decisionExists(cwd, 4)).toBe(false);
  });
});
