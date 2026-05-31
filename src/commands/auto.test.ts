import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import { load, phaseFileName, phasesDir, save, writeProject } from '../state/store.js';
import type { Phase, ProjectState, StateHeader } from '../state/types.js';

/**
 * Synchronously reads the current phase detail from the version 2 layout (header
 * + .mini/phases/phase-<id>.json). The Claude session mocks need it to write the
 * real phase steps into the report.
 */
function readCurrentPhaseSync(cwd: string): Phase {
  const header = JSON.parse(readFileSync(join(cwd, '.mini', 'state.json'), 'utf-8')) as StateHeader;
  const id = header.currentPhaseId;
  if (id === null) throw new Error('mock: no current phase in the state');
  return JSON.parse(readFileSync(join(phasesDir(cwd), phaseFileName(id)), 'utf-8')) as Phase;
}

// In auto mode the interactive `ask` must never be called. If anything in the
// next → plan → do → done chain accidentally calls it, the test must fail —
// otherwise the user would really get a prompt and `mini auto` would hang.
vi.mock('../ui/ask.js', () => ({
  ask: vi.fn(async () => {
    throw new Error('ask() must not be called in auto mode');
  }),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

// Mock the Claude calls — no real spawn(claude) in tests.
const askClaudeMock = vi.fn();
vi.mock('../claude/ask.js', () => ({
  askClaude: (...args: unknown[]) => askClaudeMock(...args),
}));

const workWithClaudeMock = vi.fn();
vi.mock('../claude/work.js', () => ({
  workWithClaude: (...args: unknown[]) => workWithClaudeMock(...args),
}));

const streamWithClaudeMock = vi.fn();
vi.mock('../claude/stream.js', () => ({
  streamWithClaude: (...args: unknown[]) => streamWithClaudeMock(...args),
}));

// Auto completes phases via `done({ auto })`, which after finalization calls
// `commitAll`. In the test we run in a tmpdir outside a git repo, but to make
// sure `git` subprocesses never run in tests, we hard-mock the git module to "not a repo".
vi.mock('../git.js', () => ({
  isGitRepo: vi.fn(async () => false),
  hasChanges: vi.fn(async () => false),
  commitAll: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  currentBranch: vi.fn(async () => null),
  headSha: vi.fn(async () => null),
  headSubject: vi.fn(async () => null),
  isCleanWorkingTree: vi.fn(async () => true),
  softResetTo: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
}));

// After phase finalization `done({ auto })` runs a memory Claude session. Like
// the other Claude calls, we hard-mock it in tests so no real spawn(claude)
// calls fly off.
vi.mock('./writeMemory.js', () => ({
  writePhaseMemory: vi.fn(async () => {}),
}));

// After setting up the mocks we import `auto` — Vitest hoists the mocks above
// the imports of the module under test.
const { auto } = await import('./auto.js');

function emptyState(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [],
  };
}

/**
 * Imitates a Claude session that writes a report at the end — `done({ auto })`
 * then reads it and advances the phase status. Without this side effect, done
 * drops into the interactive fallback and the test hits the mocked `ask`.
 *
 * The report marks all steps of the current phase as `done` (verdict `done`).
 */
function mockClaudeSessionWritingReport(cwd: string, getCurrentPhase: () => Phase) {
  return async () => {
    const phase = getCurrentPhase();
    const titles = phase.steps ?? [];
    const stepsYaml = titles.length
      ? titles
          .map(
            (s) =>
              `  - title: "${s.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n    status: done`,
          )
          .join('\n')
      : '  []';
    const body = `---\nphase: ${phase.id}\nverdict: done\nsteps:\n${stepsYaml}\n---\n\nReport from the test mock.\n`;
    await ensureRunDir(cwd);
    await writeFile(runReportPath(cwd, phase.id), body, 'utf-8');
    return { exitCode: 0 };
  };
}

describe('auto() end-to-end', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-auto-e2e-'));
    process.chdir(cwd);

    askClaudeMock.mockReset();
    workWithClaudeMock.mockReset();
    streamWithClaudeMock.mockReset();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('runs the whole next → plan → do → done cycle without a single prompt', async () => {
    await writeProject('# Test project\n\nMinimal seed for the auto test.\n', cwd);
    await save(emptyState(), cwd);

    // The first askClaude call is `next` — returns a phase suggestion.
    // The second is `plan` — returns a list of steps.
    askClaudeMock
      .mockResolvedValueOnce({
        text: 'TITLE: First automatic phase\nGOAL: verify the auto chain prompts not even once',
      })
      .mockResolvedValueOnce({
        text: 'STEP: do something small\nSTEP: verify that it works',
      });

    // `do` in auto mode runs non-interactively (without --stream) via workWithClaude.
    // The auto variant of `doPhase` runs Claude on the WHOLE phase in a single pass;
    // the mock simulates Claude having written a report marking all steps as done.
    workWithClaudeMock.mockImplementation(
      // The phase may not be in the state yet when the mock is registered (next +
      // plan run before), so we read it from the current state at call time.
      mockClaudeSessionWritingReport(cwd, () => readCurrentPhaseSync(cwd)),
    );

    await auto();

    // No stream was used (auto chain default → workWithClaude).
    expect(streamWithClaudeMock).not.toHaveBeenCalled();

    // Claude was called twice for decisions (next + plan) and once
    // for the work (the whole phase in a single pass).
    expect(askClaudeMock).toHaveBeenCalledTimes(2);
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);

    // The `do` call must run Claude in acceptEdits, otherwise Claude would ask
    // for permission for every edit tool and the whole auto would hang.
    for (const call of workWithClaudeMock.mock.calls) {
      const callOpts = call[1] as { permissionMode?: string; cwd?: string };
      expect(callOpts?.permissionMode).toBe('acceptEdits');
      expect(callOpts?.cwd).toBe(cwd);
    }

    // State after completion: phase 1 exists, is `done`, currentPhaseId is null.
    // We don't examine individual step statuses yet — in this intermediate state
    // everything goes to `skipped`; once the report parser lands, they will be `done`.
    const reloaded = await load(cwd);
    expect(reloaded.phases).toHaveLength(1);
    const phase = reloaded.phases[0];
    expect(phase?.id).toBe(1);
    expect(phase?.title).toBe('First automatic phase');
    expect(phase?.goal).toBe('verify the auto chain prompts not even once');
    expect(phase?.status).toBe('done');
    expect(phase?.completedAt).toBeTypeOf('string');
    expect(phase?.steps).toHaveLength(2);
    expect(reloaded.currentPhaseId).toBeNull();

    // The auto variant of `do` must create `.mini/run/` before starting Claude,
    // so Claude can write the report there without a collision.
    const runDirStat = await stat(join(cwd, '.mini', 'run'));
    expect(runDirStat.isDirectory()).toBe(true);
  });

  it('continues an in-progress phase without planning and also finishes without a prompt', async () => {
    await writeProject('# Test project\n', cwd);
    // A phase that already has steps and one is `doing` — auto must skip both
    // `next` (the phase exists) and `plan` (the steps exist) and go straight to
    // `do` and `done`.
    await save(
      {
        version: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentPhaseId: 1,
        phases: [
          {
            id: 1,
            title: 'In-progress phase',
            goal: 'finish the single remaining step',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'done' },
              { title: 'step 2', status: 'doing' },
            ],
          },
        ],
      },
      cwd,
    );

    workWithClaudeMock.mockImplementation(
      mockClaudeSessionWritingReport(cwd, () => readCurrentPhaseSync(cwd)),
    );

    await auto();

    // neither next nor plan may be called — the phase exists and has steps.
    expect(askClaudeMock).not.toHaveBeenCalled();
    expect(streamWithClaudeMock).not.toHaveBeenCalled();
    // The auto variant of `do` runs Claude on the whole phase in a single pass — hence 1 call.
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);

    const reloaded = await load(cwd);
    const phase = reloaded.phases[0];
    expect(phase?.status).toBe('done');
    expect(phase?.steps?.[1]?.status).toBe('done');
    expect(reloaded.currentPhaseId).toBeNull();
  });

  it('propagates --max-turns from auto({maxTurns}) all the way to workWithClaude', async () => {
    await writeProject('# Test project\n', cwd);
    await save(
      {
        version: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentPhaseId: 1,
        phases: [
          {
            id: 1,
            title: 'Phase with a turn limit',
            goal: 'verify that --max-turns propagates',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'doing' },
              { title: 'step 2', status: 'todo' },
            ],
          },
        ],
      },
      cwd,
    );

    workWithClaudeMock.mockImplementation(
      mockClaudeSessionWritingReport(cwd, () => readCurrentPhaseSync(cwd)),
    );

    await auto({ maxTurns: 7 });

    expect(streamWithClaudeMock).not.toHaveBeenCalled();
    // One pass for the whole phase — workWithClaude is called once.
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    for (const call of workWithClaudeMock.mock.calls) {
      const callOpts = call[1] as { maxTurns?: number };
      expect(callOpts?.maxTurns).toBe(7);
    }
  });

  it('without --max-turns maxTurns in the opts for workWithClaude is undefined', async () => {
    await writeProject('# Test project\n', cwd);
    await save(
      {
        version: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentPhaseId: 1,
        phases: [
          {
            id: 1,
            title: 'Phase without a limit',
            goal: 'verify default behavior',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
        ],
      },
      cwd,
    );

    workWithClaudeMock.mockImplementation(
      mockClaudeSessionWritingReport(cwd, () => readCurrentPhaseSync(cwd)),
    );

    await auto();

    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const callOpts = workWithClaudeMock.mock.calls[0]![1] as { maxTurns?: number };
    expect(callOpts?.maxTurns).toBeUndefined();
  });
});
