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
