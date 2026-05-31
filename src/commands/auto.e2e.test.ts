import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { load, save, writeProject } from '../state/store.js';
import type { ProjectState } from '../state/types.js';

// E2E test of the real auto loop (R2). Unlike `auto.test.ts`, it does NOT mock
// the Claude modules — it runs a real `spawn('claude', …)` against a fake binary
// that the test writes to disk and adds to PATH. It thus verifies the seams
// between modules: spawn → stdin/stdout → parse → report write → report parse →
// state advance.
//
// Fake `claude`:
//   - ask call (`-p`): depending on the prompt returns JSON with TITLE/GOAL
//     (next) or STEP lines (plan),
//   - work session (without `-p`): reads `.mini/state.json`, finds the current
//     phase, and writes a report marking all steps as `done` (verdict `done`).
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
    result = 'STEP: first step\\nSTEP: second step';
  } else if (/TITLE:/.test(prompt)) {
    result = 'TITLE: Fake phase\\nGOAL: verify the e2e run';
  } else {
    result = 'ok';
  }
  process.stdout.write(JSON.stringify({ type: 'result', is_error: false, result }));
  process.exit(0);
}

// Work session — write a report from the current state (version 2 layout: the
// header holds only the index, the phase detail is in .mini/phases/phase-<id>.json).
const statePath = path.join(process.cwd(), '.mini', 'state.json');
const header = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
const curId = header.currentPhaseId;
if (curId == null) {
  process.stderr.write('fake claude: no current phase\\n');
  process.exit(1);
}
const phaseFile = path.join(process.cwd(), '.mini', 'phases', 'phase-' + String(curId).padStart(3, '0') + '.json');
const phase = JSON.parse(fs.readFileSync(phaseFile, 'utf-8'));
const steps = phase.steps || [];
const stepsYaml = steps.length
  ? steps.map((s) => '  - title: ' + JSON.stringify(s.title) + '\\n    status: done').join('\\n')
  : '  []';
const report = '---\\nphase: ' + phase.id + '\\nverdict: done\\nsteps:\\n' + stepsYaml + '\\n---\\n\\nFake e2e report.\\n';
const runDir = path.join(process.cwd(), '.mini', 'run');
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, 'phase-' + String(phase.id).padStart(3, '0') + '.md'), report);
process.exit(0);
`;

function emptyState(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [],
  };
}

describe('auto() e2e against a fake claude binary (R2)', () => {
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

    // The fake binary must take precedence over any real `claude` in PATH.
    prevPath = process.env.PATH;
    process.env.PATH = `${binDir}${delimiter}${prevPath ?? ''}`;

    process.chdir(cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    process.env.PATH = prevPath;
    await rm(cwd, { recursive: true, force: true });
  });

  it('runs through next → plan → do → done and closes the phase', async () => {
    await writeProject('# E2E project\n', cwd);
    await save(emptyState(), cwd);

    const { auto } = await import('./auto.js');
    await auto();

    const reloaded = await load(cwd);
    expect(reloaded.phases).toHaveLength(1);
    const phase = reloaded.phases[0];
    expect(phase?.id).toBe(1);
    expect(phase?.title).toBe('Fake phase');
    expect(phase?.goal).toBe('verify the e2e run');
    expect(phase?.status).toBe('done');
    expect(phase?.steps?.map((s) => s.title)).toEqual(['first step', 'second step']);
    expect(phase?.steps?.every((s) => s.status === 'done')).toBe(true);
    expect(reloaded.currentPhaseId).toBeNull();
  }, 30000);
});
