import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamResult } from '../claude/stream.js';
import { logStreamSummary } from './usage.js';

describe('logStreamSummary', () => {
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

  it('prints nothing when the result has no metrics', () => {
    logStreamSummary({ exitCode: 0 } satisfies StreamResult);
    expect(logs).toHaveLength(0);
  });

  it('prints a summary with a clear label separable from the stream of actions', () => {
    logStreamSummary({
      exitCode: 0,
      durationMs: 12_345,
      numTurns: 3,
      costUsd: 0.0123,
      usage: {
        inputTokens: 1000,
        outputTokens: 200,
        cacheReadTokens: 5000,
        cacheCreationTokens: 0,
      },
    });
    expect(logs).toHaveLength(1);
    const line = logs[0]!;
    expect(line).toContain('Stream summary');
    expect(line).toContain('3 turns');
    expect(line).toContain('output');
    expect(line).toContain('from cache');
    expect(line).toContain('$0.012');
  });
});
