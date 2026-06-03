import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type TodoItem,
  markTodoDone,
  parseTodos,
  readTodos,
  serializeTodos,
  writeTodos,
} from './todoStore.js';

describe('parseTodos', () => {
  it('parses open and done checklist items', () => {
    const md = '# Ideas\n\n- [ ] add a backlog\n- [x] ship release\n* [X] alt bullet\n';
    expect(parseTodos(md)).toEqual<TodoItem[]>([
      { text: 'add a backlog', done: false },
      { text: 'ship release', done: true },
      { text: 'alt bullet', done: true },
    ]);
  });

  it('ignores non-checklist lines and blank items', () => {
    const md = '# Heading\n> a note\nplain text\n- [ ]   \n- [ ] real item\n';
    expect(parseTodos(md)).toEqual<TodoItem[]>([{ text: 'real item', done: false }]);
  });

  it('returns an empty list for empty input', () => {
    expect(parseTodos('')).toEqual([]);
  });
});

describe('serializeTodos', () => {
  it('renders a checklist with a trailing newline', () => {
    const out = serializeTodos([
      { text: 'one', done: false },
      { text: 'two', done: true },
    ]);
    expect(out).toContain('- [ ] one');
    expect(out).toContain('- [x] two');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('shows a placeholder when there are no items', () => {
    expect(serializeTodos([])).toContain('_(empty)_');
  });
});

describe('round-trip', () => {
  it('parse(serialize(items)) preserves the items', () => {
    const items: TodoItem[] = [
      { text: 'add a backlog', done: false },
      { text: 'ship release', done: true },
    ];
    expect(parseTodos(serializeTodos(items))).toEqual(items);
  });
});

describe('markTodoDone', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-todo-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('ticks off an open item by its 1-based position and persists it', async () => {
    await writeTodos(
      [
        { text: 'first', done: false },
        { text: 'second', done: false },
      ],
      cwd,
    );

    const result = await markTodoDone(2, cwd);

    expect(result).toEqual({ status: 'ticked', text: 'second' });
    expect(await readTodos(cwd)).toEqual<TodoItem[]>([
      { text: 'first', done: false },
      { text: 'second', done: true },
    ]);
  });

  it('counts done items in the numbering (same as mini todo done <n>)', async () => {
    await writeTodos(
      [
        { text: 'done one', done: true },
        { text: 'open two', done: false },
      ],
      cwd,
    );

    const result = await markTodoDone(2, cwd);

    expect(result).toEqual({ status: 'ticked', text: 'open two' });
  });

  it('reports an already-done item without rewriting', async () => {
    await writeTodos([{ text: 'shipped', done: true }], cwd);

    expect(await markTodoDone(1, cwd)).toEqual({ status: 'already-done', text: 'shipped' });
  });

  it('reports an out-of-range index', async () => {
    await writeTodos([{ text: 'only', done: false }], cwd);

    expect((await markTodoDone(2, cwd)).status).toBe('out-of-range');
    expect((await markTodoDone(0, cwd)).status).toBe('out-of-range');
    expect((await markTodoDone(1.5, cwd)).status).toBe('out-of-range');
  });

  it('reports an empty archive', async () => {
    expect(await markTodoDone(1, cwd)).toEqual({ status: 'no-todos' });
  });
});
