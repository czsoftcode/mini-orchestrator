import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { save, writeProject } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';

const execFileAsync = promisify(execFile);

// Interactive: security asks for confirmation before starting Claude.
const askMock = vi.fn((..._args: unknown[]) => Promise.resolve({ confirm: true }));
vi.mock('../ui/ask.js', () => ({
  ask: (...args: unknown[]) => askMock(...args),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

const workWithClaudeMock = vi.fn((..._args: unknown[]) => Promise.resolve({ exitCode: 0 }));
vi.mock('../claude/work.js', () => ({
  workWithClaude: (...args: unknown[]) => workWithClaudeMock(...args),
}));

// The resolve+build path (resolveSecurityTarget → buildSecurityReviewContext) is
// exercised by securityTarget.test.ts and securityReviewContext.test.ts; here we
// mock buildSecurityContext to isolate the command's wiring (confirm flow, scoped
// tools, null → no session) from range resolution and prompt assembly.
type Ctx = { prompt: string; outputPath: string } | null;
const SEC_CTX: Ctx = { prompt: 'SEC PROMPT', outputPath: join('.mini', 'security', 'phase-2.md') };
const buildContextMock = vi.fn((..._args: unknown[]) => Promise.resolve<Ctx>(SEC_CTX));
vi.mock('./securityReviewContext.js', () => ({
  buildSecurityContext: (...args: unknown[]) => buildContextMock(...args),
}));

const { security, SECURITY_ALLOWED_TOOLS } = await import('./security.js');

async function initRepo(cwd: string): Promise<void> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'mini-test@example.com'], { cwd });
  await execFileAsync('git', ['config', 'user.name', 'Mini Test'], { cwd });
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
}

async function commit(cwd: string, name: string): Promise<string> {
  await writeFile(join(cwd, name), `${name}\n`);
  await execFileAsync('git', ['add', '-A'], { cwd });
  await execFileAsync('git', ['commit', '-m', name], { cwd });
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd });
  return stdout.trim();
}

function donePhase(id: number, preSha?: string): Phase {
  const phase: Phase = { id, title: `P${id}`, status: 'done' };
  if (preSha) phase.autoCommit = { preSha, subject: `Phase ${id}` };
  return phase;
}

function stateOf(phases: Phase[]): ProjectState {
  return { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId: null, phases };
}

describe('security command', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-security-'));
    process.chdir(cwd);
    await initRepo(cwd);
    workWithClaudeMock.mockReset();
    workWithClaudeMock.mockResolvedValue({ exitCode: 0 });
    askMock.mockReset();
    askMock.mockResolvedValue({ confirm: true });
    buildContextMock.mockReset();
    buildContextMock.mockResolvedValue(SEC_CTX);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('does nothing when there is no project', async () => {
    // No save() → no .mini/state.json.
    const r = await security({});
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('no-project');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('default (no flags) threads the input through and starts a session with the scoped tool set', async () => {
    const c1 = await commit(cwd, 'a');
    await commit(cwd, 'b');
    await writeProject('# Project', cwd);
    await save(stateOf([donePhase(1, c1)]), cwd);

    const r = await security({});

    expect(r.ok).toBe(true);
    // The command passes the RangeInput straight to the resolve+build path; the
    // range/outputPath derivation itself is covered by securityTarget.test.ts.
    expect(buildContextMock).toHaveBeenCalledWith(cwd, {});
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const [prompt, opts] = workWithClaudeMock.mock.calls[0]! as [string, { allowedTools?: string[] }];
    expect(prompt).toBe('SEC PROMPT');
    expect(opts.allowedTools).toEqual(SECURITY_ALLOWED_TOOLS);
    expect(opts.allowedTools).not.toContain('Edit');
  });

  it('phase flags are passed through to the resolve+build path', async () => {
    const c1 = await commit(cwd, 'a');
    await commit(cwd, 'b');
    await writeProject('# Project', cwd);
    await save(stateOf([donePhase(1, c1)]), cwd);

    const r = await security({ fromPhase: 1, toPhase: 2 });

    expect(r.ok).toBe(true);
    expect(buildContextMock).toHaveBeenCalledWith(cwd, { fromPhase: 1, toPhase: 2 });
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
  });

  it('does not start a session when the context cannot be built (null)', async () => {
    const c1 = await commit(cwd, 'a');
    await writeProject('# Project', cwd);
    await save(stateOf([donePhase(1, c1)]), cwd);
    buildContextMock.mockResolvedValueOnce(null);

    const r = await security({});

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('range-error');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('does not start Claude when the user cancels at the confirmation', async () => {
    const c1 = await commit(cwd, 'a');
    await commit(cwd, 'b');
    await writeProject('# Project', cwd);
    await save(stateOf([donePhase(1, c1)]), cwd);
    askMock.mockResolvedValueOnce({ confirm: false });

    const r = await security({});

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('cancelled');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });
});
