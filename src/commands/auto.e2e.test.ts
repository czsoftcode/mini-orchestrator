import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { load, save, writeProject } from '../state/store.js';
import type { ProjectState } from '../state/types.js';

// E2E test reálné auto smyčky (R2). Na rozdíl od `auto.test.ts` NEmockuje
// Claude moduly — spouští skutečné `spawn('claude', …)` proti fake binárce,
// kterou si test napíše na disk a přidá do PATH. Ověří tak švy mezi moduly:
// spawn → stdin/stdout → parse → zápis reportu → parse reportu → posun stavu.
//
// Fake `claude`:
//   - ask volání (`-p`): podle promptu vrátí JSON s TITLE/GOAL (next) nebo
//     STEP řádky (plan),
//   - work session (bez `-p`): přečte `.mini/state.json`, najde aktuální fázi
//     a zapíše report označující všechny kroky jako `done` (verdict `done`).
const FAKE_CLAUDE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isAsk = args.includes('-p');

if (isAsk) {
  const prompt = fs.readFileSync(0, 'utf-8');
  let result;
  if (/STEP:/.test(prompt)) {
    result = 'STEP: první krok\\nSTEP: druhý krok';
  } else if (/TITLE:/.test(prompt)) {
    result = 'TITLE: Fake fáze\\nGOAL: ověřit e2e průchod';
  } else {
    result = 'ok';
  }
  process.stdout.write(JSON.stringify({ type: 'result', is_error: false, result }));
  process.exit(0);
}

// Work session — zapíšeme report podle aktuálního stavu.
const statePath = path.join(process.cwd(), '.mini', 'state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
const phase = state.phases.find((p) => p.id === state.currentPhaseId);
if (!phase) {
  process.stderr.write('fake claude: žádná aktuální fáze\\n');
  process.exit(1);
}
const steps = phase.steps || [];
const stepsYaml = steps.length
  ? steps.map((s) => '  - title: ' + JSON.stringify(s.title) + '\\n    status: done').join('\\n')
  : '  []';
const report = '---\\nphase: ' + phase.id + '\\nverdict: done\\nsteps:\\n' + stepsYaml + '\\n---\\n\\nFake e2e report.\\n';
const runDir = path.join(process.cwd(), '.mini', 'run');
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, 'phase-' + phase.id + '.md'), report);
process.exit(0);
`;

function emptyState(): ProjectState {
  return {
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [],
  };
}

describe('auto() e2e proti fake claude binárce (R2)', () => {
  let cwd: string;
  let binDir: string;
  let prevCwd: string;
  let prevPath: string | undefined;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-auto-realbin-'));
    binDir = join(cwd, '.fakebin');
    await mkdir(binDir, { recursive: true });
    const fakeClaudePath = join(binDir, 'claude');
    await writeFile(fakeClaudePath, FAKE_CLAUDE, 'utf-8');
    await chmod(fakeClaudePath, 0o755);

    // Fake binárka musí mít přednost před případným reálným `claude` v PATH.
    prevPath = process.env.PATH;
    process.env.PATH = `${binDir}${delimiter}${prevPath ?? ''}`;

    process.chdir(cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    process.env.PATH = prevPath;
    await rm(cwd, { recursive: true, force: true });
  });

  it('projede next → plan → do → done a uzavře fázi', async () => {
    await writeProject('# E2E projekt\n', cwd);
    await save(emptyState(), cwd);

    const { auto } = await import('./auto.js');
    await auto();

    const reloaded = await load(cwd);
    expect(reloaded.phases).toHaveLength(1);
    const phase = reloaded.phases[0];
    expect(phase?.id).toBe(1);
    expect(phase?.title).toBe('Fake fáze');
    expect(phase?.goal).toBe('ověřit e2e průchod');
    expect(phase?.status).toBe('done');
    expect(phase?.steps?.map((s) => s.title)).toEqual(['první krok', 'druhý krok']);
    expect(phase?.steps?.every((s) => s.status === 'done')).toBe(true);
    expect(reloaded.currentPhaseId).toBeNull();
  }, 30000);
});
