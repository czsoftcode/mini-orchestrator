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

  it('netiskne nic, když výsledek nemá žádné metriky', () => {
    logStreamSummary({ exitCode: 0 } satisfies StreamResult);
    expect(logs).toHaveLength(0);
  });

  it('vypíše souhrn s jasným labelem oddělitelným od proudu akcí', () => {
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
    expect(line).toContain('Souhrn streamu');
    expect(line).toContain('3 odpovědi');
    expect(line).toContain('output');
    expect(line).toContain('z cache');
    expect(line).toContain('$0.012');
  });
});
