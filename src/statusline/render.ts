/**
 * Renders the parsed statusline data into the single line Claude Code displays.
 *
 * Layout: `<dir> · <model> · <window> <bar> <pct>%`
 *   - dir:    the basename of the working directory, truncated so a deep path
 *             never blows up the line.
 *   - model:  the model display name verbatim (e.g. "Opus 4.8").
 *   - window: the context-window size label ("1M" / "200k").
 *   - bar:    a fixed-width graphical gauge of the usage.
 *   - pct:    the same usage as a number.
 *   - upgrade: an optional trailing `↑ <version>`, shown in yellow only when a
 *             newer mini version is available on npm.
 *
 * Pure: data in → string out. Colors are raw ANSI escape codes (NOT picocolors)
 * because Claude Code runs this command with stdout piped, not a TTY — picocolors
 * would auto-strip the colors there. Color is opt-out via the `color` option so
 * the plain string stays trivial to snapshot-test.
 */

import { basename } from 'node:path';
import type { StatuslineData } from './statusline.js';

const SEP = ' · ';

/** Raw ANSI escape codes (no TTY detection — Claude Code renders them). */
const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  boldCyan: '\x1b[1;36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
} as const;

/** Wraps `text` in an ANSI code (+ reset) when `on`, otherwise returns it bare. */
function paint(text: string, code: string, on: boolean): string {
  return on ? `${code}${text}${ANSI.reset}` : text;
}

/** Threshold color for the usage gauge: green < 60 %, yellow 60–85 %, red > 85 %. */
export function usageColor(percent: number): string {
  if (percent > 85) return ANSI.red;
  if (percent >= 60) return ANSI.yellow;
  return ANSI.green;
}
/** Max characters of the directory name before it gets truncated with an ellipsis. */
const DIR_MAX = 24;
/** Number of cells in the usage gauge. */
const BAR_CELLS = 10;
const BAR_FULL = '▰';
const BAR_EMPTY = '▱';

/** Basename of a path, truncated to `max` chars with a trailing ellipsis. */
export function shortDir(dir: string, max = DIR_MAX): string {
  const name = basename(dir);
  if (name.length <= max) return name;
  return `${name.slice(0, Math.max(0, max - 1))}…`;
}

/** Human label for the context-window size: "1M" or "200k". */
export function windowLabel(windowTokens: number): string {
  if (windowTokens >= 1_000_000) {
    const m = windowTokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return `${Math.round(windowTokens / 1000)}k`;
}

/** Usage as a whole-number percentage of the window, clamped to 0..100. */
export function usagePercent(used: number, window: number): number {
  if (window <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used * 100) / window)));
}

/** A `BAR_CELLS`-wide gauge filled proportionally to the percentage. */
export function usageBar(percent: number, cells = BAR_CELLS): string {
  const filled = Math.min(cells, Math.max(0, Math.round((percent / 100) * cells)));
  return BAR_FULL.repeat(filled) + BAR_EMPTY.repeat(cells - filled);
}

export interface RenderOptions {
  /** Emit ANSI colors. On by default; tests pass `false` for plain strings. */
  color?: boolean;
}

/**
 * Renders the whole statusline. With color: the directory is bold cyan, the
 * model stays the terminal default, the window+gauge+percent are tinted by usage
 * (green/yellow/red), and the `·` separators are dimmed.
 */
export function renderStatusline(data: StatuslineData, options: RenderOptions = {}): string {
  const color = options.color ?? true;
  const parts: string[] = [];

  const dir = shortDir(data.dir);
  if (dir) parts.push(paint(dir, ANSI.boldCyan, color));

  if (data.model) parts.push(data.model);

  const pct = usagePercent(data.usedTokens, data.windowTokens);
  const gauge = `${windowLabel(data.windowTokens)} ${usageBar(pct)} ${pct}%`;
  parts.push(paint(gauge, usageColor(pct), color));

  if (data.upgrade) parts.push(paint(`↑ ${data.upgrade}`, ANSI.yellow, color));

  const sep = color ? ` ${paint('·', ANSI.dim, true)} ` : SEP;
  return parts.join(sep);
}
