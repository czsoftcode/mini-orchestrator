import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { todoPath } from './store.js';

/** A single entry in the ideas/changes archive `.mini/todo.md`. */
export interface TodoItem {
  /** The idea / change text (one line). */
  text: string;
  /** Whether the item has been ticked off (`- [x]`). */
  done: boolean;
}

const HEADER = [
  '# Ideas & changes',
  '',
  '> Archive of future ideas and changes for this project. Managed by `mini todo`',
  '> (`add` / `done` / `remove`); `mini next` offers the open items as candidate',
  '> phase ideas. You can also edit this checklist by hand.',
  '',
].join('\n');

/** Matches a markdown checklist line `- [ ] text` / `- [x] text` (case-insensitive). */
const ITEM_RE = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;

/**
 * Parses the markdown checklist into typed items. Any non-checklist line
 * (heading, blockquote, blank) is ignored, so a hand-written header survives
 * a parse → serialize round-trip. Empty item texts are dropped.
 */
export function parseTodos(md: string): TodoItem[] {
  const items: TodoItem[] = [];
  for (const line of md.split('\n')) {
    const m = ITEM_RE.exec(line);
    if (!m) continue;
    const [, mark, rest] = m;
    if (mark === undefined || rest === undefined) continue;
    const text = rest.trim();
    if (!text) continue;
    items.push({ text, done: mark.toLowerCase() === 'x' });
  }
  return items;
}

/** Renders items back into `.mini/todo.md` (header + checklist). */
export function serializeTodos(items: TodoItem[]): string {
  const lines = items.map((it) => `- [${it.done ? 'x' : ' '}] ${it.text}`);
  const body = lines.length > 0 ? lines.join('\n') : '_(empty)_';
  return `${HEADER}${body}\n`;
}

/** Outcome of {@link markTodoDone} — what happened to the referenced item. */
export type MarkTodoResult =
  | { status: 'ticked'; text: string }
  | { status: 'already-done'; text: string }
  | { status: 'out-of-range' }
  | { status: 'no-todos' };

/**
 * Ticks off the archive item at the 1-based position `n` (counted over **all**
 * items, done and open alike — the same numbering as `mini todo done <n>`),
 * persisting the change. Used by `mini next --apply --from-todo <n>` to tick off
 * the backlog item a phase was created from.
 *
 * Never throws on a bad reference: an empty archive, an out-of-range index or an
 * item that is already ticked off each yield a descriptive result the caller can
 * turn into a warning.
 */
export async function markTodoDone(
  n: number,
  cwd: string = process.cwd(),
): Promise<MarkTodoResult> {
  const items = await readTodos(cwd);
  if (items.length === 0) {
    return { status: 'no-todos' };
  }
  if (!Number.isInteger(n) || n < 1 || n > items.length) {
    return { status: 'out-of-range' };
  }
  const item = items[n - 1];
  if (!item) {
    return { status: 'out-of-range' };
  }
  if (item.done) {
    return { status: 'already-done', text: item.text };
  }
  item.done = true;
  await writeTodos(items, cwd);
  return { status: 'ticked', text: item.text };
}

/** Reads and parses `.mini/todo.md`; a missing file yields an empty list. */
export async function readTodos(cwd: string = process.cwd()): Promise<TodoItem[]> {
  try {
    return parseTodos(await readFile(todoPath(cwd), 'utf-8'));
  } catch {
    return [];
  }
}

/** Serializes and writes the items to `.mini/todo.md` (creating `.mini/` if needed). */
export async function writeTodos(
  items: TodoItem[],
  cwd: string = process.cwd(),
): Promise<void> {
  const path = todoPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeTodos(items), 'utf-8');
}
