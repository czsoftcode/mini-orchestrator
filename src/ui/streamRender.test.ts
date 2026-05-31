import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../claude/stream.js';
import { createStreamRenderer } from './streamRender.js';

describe('createStreamRenderer', () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((msg?: unknown) => {
      logs.push(String(msg ?? ''));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function feed(events: StreamEvent[]): void {
    const r = createStreamRenderer();
    for (const e of events) r.onEvent(e);
  }

  it('separates the session header from the stream of actions with a blank line', () => {
    feed([
      { kind: 'system-init', model: 'claude-x', cwd: '/tmp/p', raw: {} },
    ]);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain('Claude session started');
    expect(logs[0]).toContain('claude-x');
    expect(logs[1]).toBe('');
  });

  it('prints a text preview and each used tool with its argument', () => {
    feed([
      {
        kind: 'assistant',
        textParts: ['Pracuji na tom\ndalší řádek'],
        toolUses: [{ id: 't1', name: 'Read', input: { file_path: '/a/b.ts' } }],
        raw: {},
      },
    ]);
    const joined = logs.join('\n');
    expect(joined).toContain('Pracuji na tom');
    expect(joined).not.toContain('další řádek');
    expect(joined).toContain('Read');
    expect(joined).toContain('/a/b.ts');
  });

  it('reports only errors from tool results (success is silent)', () => {
    feed([
      {
        kind: 'assistant',
        textParts: [],
        toolUses: [{ id: 't1', name: 'Bash', input: { command: 'ls' } }],
        raw: {},
      },
      {
        kind: 'user',
        toolResults: [
          { toolUseId: 't1', isError: true, contentPreview: 'command not found' },
          { toolUseId: 'tX', isError: false, contentPreview: 'ok' },
        ],
        raw: {},
      },
    ]);
    const joined = logs.join('\n');
    expect(joined).toContain('Bash failed');
    expect(joined).toContain('command not found');
    expect(joined).not.toContain('ok');
  });

  it('ignores result and unknown events', () => {
    feed([
      { kind: 'result', raw: {} },
      { kind: 'unknown', type: 'whatever', raw: {} },
    ]);
    expect(logs).toHaveLength(0);
  });
});
