import pc from 'picocolors';

import type { AskResult } from '../claude/ask.js';
import type { StreamResult } from '../claude/stream.js';
import { log } from './log.js';

export function logUsage(response: AskResult): void {
  if (!response.usage) {
    return;
  }
  const u = response.usage;
  const total = u.inputTokens + u.outputTokens + u.cacheCreationTokens + u.cacheReadTokens;

  const parts: string[] = [];
  parts.push(`${formatTokens(total)} tokens`);
  parts.push(`${u.outputTokens.toLocaleString()} output`);
  if (u.cacheReadTokens > 0) {
    parts.push(`${formatTokens(u.cacheReadTokens)} from cache`);
  }
  if (response.costUsd !== undefined && response.costUsd > 0) {
    parts.push(`~$${response.costUsd.toFixed(3)} in API`);
  }
  log.dim(`  (${parts.join(' · ')})`);
}

/**
 * Final summary after the Claude stream finishes (`mini do --stream`).
 * Prints the duration, number of turns, tokens and cost — everything available.
 * When the result contains no metrics (e.g. the process crashed before a `result`),
 * it prints nothing silently, so it does not bother the user with an empty line.
 */
export function logStreamSummary(result: StreamResult): void {
  const parts: string[] = [];

  if (result.durationMs !== undefined && result.durationMs > 0) {
    parts.push(formatDuration(result.durationMs));
  }
  if (result.numTurns !== undefined && result.numTurns > 0) {
    parts.push(`${result.numTurns} ${pluralTurns(result.numTurns)}`);
  }
  if (result.usage) {
    const u = result.usage;
    const total = u.inputTokens + u.outputTokens + u.cacheCreationTokens + u.cacheReadTokens;
    parts.push(`${formatTokens(total)} tokens`);
    parts.push(`${u.outputTokens.toLocaleString()} output`);
    if (u.cacheReadTokens > 0) {
      parts.push(`${formatTokens(u.cacheReadTokens)} from cache`);
    }
  }
  if (result.costUsd !== undefined && result.costUsd > 0) {
    parts.push(`~$${result.costUsd.toFixed(3)} in API`);
  }

  if (parts.length === 0) {
    return;
  }
  // The summary must clearly stand out from the stream of actions above — hence a
  // bold label separated from the (dimmed) metrics. The caller (`mini do --stream`)
  // prints a blank line before this, so the block is visually separated from the last action.
  console.log(`${pc.bold('Stream summary')} ${pc.dim('·')} ${pc.dim(parts.join(' · '))}`);
}

function formatTokens(n: number): string {
  if (n >= 10000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.round(seconds - minutes * 60);
  return restSeconds > 0 ? `${minutes} min ${restSeconds} s` : `${minutes} min`;
}

function pluralTurns(n: number): string {
  return n === 1 ? 'turn' : 'turns';
}
