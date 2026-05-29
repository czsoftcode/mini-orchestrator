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
  parts.push(`${formatTokens(total)} tokenů`);
  parts.push(`${u.outputTokens.toLocaleString()} output`);
  if (u.cacheReadTokens > 0) {
    parts.push(`${formatTokens(u.cacheReadTokens)} z cache`);
  }
  if (response.costUsd !== undefined && response.costUsd > 0) {
    parts.push(`~$${response.costUsd.toFixed(3)} v API`);
  }
  log.dim(`  (${parts.join(' · ')})`);
}

/**
 * Závěrečný souhrn po doběhnutí Claude streamu (`mini do --stream`).
 * Vypíše dobu trvání, počet odpovědí, tokeny a cenu — vše, co je k dispozici.
 * Když výsledek neobsahuje žádné metriky (např. proces spadl dřív, než došlo k `result`),
 * tiše nic netiskne, aby uživatele nezatěžoval prázdným řádkem.
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
    parts.push(`${formatTokens(total)} tokenů`);
    parts.push(`${u.outputTokens.toLocaleString()} output`);
    if (u.cacheReadTokens > 0) {
      parts.push(`${formatTokens(u.cacheReadTokens)} z cache`);
    }
  }
  if (result.costUsd !== undefined && result.costUsd > 0) {
    parts.push(`~$${result.costUsd.toFixed(3)} v API`);
  }

  if (parts.length === 0) {
    return;
  }
  // Souhrn musí jasně vystoupit z proudu akcí výše — proto bold label oddělený
  // od (tlumených) metrik. Volající (`mini do --stream`) před tím tiskne prázdný
  // řádek, takže blok je opticky oddělený od poslední akce.
  console.log(`${pc.bold('Souhrn streamu')} ${pc.dim('·')} ${pc.dim(parts.join(' · '))}`);
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
  if (n === 1) return 'odpověď';
  if (n >= 2 && n <= 4) return 'odpovědi';
  return 'odpovědí';
}
