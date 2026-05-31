import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { context, isContextCommand, CONTEXT_COMMANDS } from './context.js';
import { save } from '../state/store.js';
import { writeProject } from '../state/store.js';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import type { Phase, ProjectState } from '../state/types.js';

let cwd: string;
let out: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let writeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-context-'));
  out = '';
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    out += String(chunk);
    return true;
  });
  process.exitCode = undefined;
});

afterEach(async () => {
  cwdSpy.mockRestore();
  writeSpy.mockRestore();
  process.exitCode = undefined;
  await rm(cwd, { recursive: true, force: true });
});

function makeState(phases: Phase[], currentPhaseId: number | null): ProjectState {
  return { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId, phases };
}

async function setupProject(phases: Phase[], currentPhaseId: number | null): Promise<void> {
  await writeProject('# Demo\n\n## What I am building\nSomething.', cwd);
  await save(makeState(phases, currentPhaseId), cwd);
}

describe('isContextCommand', () => {
  it('knows the cycle commands and verify', () => {
    expect(CONTEXT_COMMANDS).toEqual(['next', 'discuss', 'plan', 'do', 'done', 'verify']);
    expect(isContextCommand('plan')).toBe(true);
    expect(isContextCommand('verify')).toBe(true);
    expect(isContextCommand('auto')).toBe(false);
  });
});

describe('context', () => {
  it('unknown sub-command → exit code 1, nothing on stdout', async () => {
    await setupProject([], null);
    await context('auto');
    expect(process.exitCode).toBe(1);
    expect(out).toBe('');
  });

  it('without a project → exit code 1', async () => {
    await context('next');
    expect(process.exitCode).toBe(1);
  });

  it('next prints a prompt with mini next --apply', async () => {
    await setupProject([], null);
    await context('next');
    expect(process.exitCode).toBeUndefined();
    expect(out).toContain('mini next --apply');
    expect(out).toContain('**next** step');
  });

  it('next takes extra arguments as the user idea', async () => {
    await setupProject([], null);
    await context('next', ['add', 'CSV', 'export']);
    expect(out).toContain('add CSV export');
    expect(out).toContain("User's idea");
  });

  it('plan without a current phase → exit code 1', async () => {
    await setupProject([], null);
    await context('plan');
    expect(process.exitCode).toBe(1);
    expect(out).toBe('');
  });

  it('plan with a current phase prints a prompt with mini plan --apply', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'proposed' }], 1);
    await context('plan');
    expect(out).toContain('mini plan --apply');
    expect(out).toContain('Phase 1: Phase A');
  });

  it('discuss prints a discussion prompt', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'proposed' }], 1);
    await context('discuss');
    expect(out).toContain('discussion session');
    expect(out).toContain('.mini/discuss/phase-001.md');
  });

  it('do prints the auto prompt with the instruction to write a report', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'planned', steps: [{ title: 's', status: 'todo' }] }], 1);
    await context('do');
    expect(out).toContain('.mini/run/phase-001.md');
    expect(out).toContain('Report at the end of the session');
  });

  it('do without discussion notes omits the notes block', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'planned', steps: [{ title: 's', status: 'todo' }] }], 1);
    await context('do');
    expect(out).not.toContain('# Phase notes (from discussion)');
  });

  it('do with existing notes → link + read-once, not inline text', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'planned', steps: [{ title: 's', status: 'todo' }] }], 1);
    await mkdir(join(cwd, '.mini', 'discuss'), { recursive: true });
    await writeFile(
      join(cwd, '.mini', 'discuss', 'phase-001.md'),
      '# Phase 1\n\n## Intent\nSECRET INLINE TEXT MUST NOT BE IN THE PROMPT',
      'utf-8',
    );
    await context('do');
    // Reference mode: link to the file + read-once instruction, but not the full text.
    expect(out).toContain('# Phase notes (from discussion)');
    expect(out).toContain('.mini/discuss/phase-001.md');
    expect(out).toContain('Read');
    expect(out).not.toContain('SECRET INLINE TEXT MUST NOT BE IN THE PROMPT');
  });

  it('do project → link to .mini/project.md + read-once, not the inline project text', async () => {
    await setupProject(
      [{ id: 1, title: 'Phase A', goal: 'goal', status: 'planned', steps: [{ title: 's', status: 'todo' }] }],
      1,
    );
    await context('do');
    // Project reference mode: a link to the file instead of the inlined project.md content.
    expect(out).toContain('.mini/project.md');
    expect(out).toContain('Read');
    // The inline project.md body (see setupProject) must not appear.
    expect(out).not.toContain('Something.');
  });

  it('done without a report sends to /mini:do', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'doing', steps: [{ title: 's', status: 'doing' }] }], 1);
    await context('done');
    expect(out).toContain('/mini:do');
  });

  it('done with a report prints the summary and mini done --apply', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'doing', steps: [{ title: 'step 1', status: 'doing' }] }], 1);
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      ['---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "step 1"', '    status: done', '---', '', 'all good'].join('\n'),
      'utf-8',
    );
    await context('done');
    expect(out).toContain('mini done --apply');
    expect(out).toContain('all good');
  });

  it('done with verify items in the report requires --accept-verify', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'doing', steps: [{ title: 'step 1', status: 'doing' }] }], 1);
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "step 1"', '    status: done',
        'verify:', '  - title: "check the UI"', '---', '', 'text',
      ].join('\n'),
      'utf-8',
    );
    await context('done');
    expect(out).toContain('--accept-verify');
    expect(out).toContain('check the UI');
  });

  it('verify without a current or closed phase → exit code 1', async () => {
    await setupProject([{ id: 1, title: 'Phase A', goal: 'goal', status: 'proposed' }], null);
    await context('verify');
    expect(process.exitCode).toBe(1);
    expect(out).toBe('');
  });

  it('verify with a current phase prints the UI/UX review prompt', async () => {
    await setupProject(
      [{ id: 1, title: 'Phase A', goal: 'goal', status: 'doing', steps: [{ title: 'step 1', status: 'doing' }] }],
      1,
    );
    await context('verify');
    expect(process.exitCode).toBeUndefined();
    expect(out).toContain('**verify** step');
    expect(out).toContain('Phase 1: Phase A');
    expect(out).toContain('not yet closed');
  });

  it('verify without a current phase takes the last closed one', async () => {
    await setupProject(
      [
        { id: 1, title: 'Old', goal: 'goal', status: 'done' },
        { id: 2, title: 'Last done', goal: 'goal', status: 'done' },
      ],
      null,
    );
    await context('verify');
    expect(process.exitCode).toBeUndefined();
    expect(out).toContain('Phase 2: Last done');
    expect(out).toContain('is already closed');
  });

  it('verify reads the verify items from the phase report', async () => {
    await setupProject(
      [{ id: 1, title: 'Phase A', goal: 'goal', status: 'doing', steps: [{ title: 'step 1', status: 'doing' }] }],
      1,
    );
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "step 1"', '    status: done',
        'verify:', '  - title: "check the UI"', '---', '', 'text',
      ].join('\n'),
      'utf-8',
    );
    await context('verify');
    expect(out).toContain('check the UI');
  });
});
