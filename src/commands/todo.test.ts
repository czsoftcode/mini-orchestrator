import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newState, save } from '../state/store.js';
import { readTodos } from '../state/todoStore.js';
import { todo } from './todo.js';

describe('todo', () => {
  let prevCwd: string;
  let cwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-todo-'));
    process.chdir(cwd);
    await save(newState(), cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('add appends an open item joining the args', async () => {
    await todo('add', ['support', 'for', 'plugins']);
    expect(await readTodos(cwd)).toEqual([{ text: 'support for plugins', done: false }]);
  });

  it('add ignores empty text', async () => {
    await todo('add', ['   ']);
    expect(await readTodos(cwd)).toEqual([]);
  });

  it('done ticks the referenced item', async () => {
    await todo('add', ['first']);
    await todo('add', ['second']);
    await todo('done', ['2']);
    expect(await readTodos(cwd)).toEqual([
      { text: 'first', done: false },
      { text: 'second', done: true },
    ]);
  });

  it('remove (and alias rm) drop the referenced item', async () => {
    await todo('add', ['a']);
    await todo('add', ['b']);
    await todo('add', ['c']);
    await todo('remove', ['2']);
    expect(await readTodos(cwd)).toEqual([
      { text: 'a', done: false },
      { text: 'c', done: false },
    ]);
    await todo('rm', ['1']);
    expect(await readTodos(cwd)).toEqual([{ text: 'c', done: false }]);
  });

  it('out-of-range index changes nothing', async () => {
    await todo('add', ['only']);
    await todo('done', ['5']);
    await todo('remove', ['0']);
    expect(await readTodos(cwd)).toEqual([{ text: 'only', done: false }]);
  });

  it('list prints the available actions hint when there are items', async () => {
    await todo('add', ['something']);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await todo();
    const out = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    spy.mockRestore();
    expect(out).toContain('Actions:');
    expect(out).toContain('done <n>');
    expect(out).toContain('remove <n>');
  });

  it('empty archive keeps the add hint', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await todo();
    const out = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    spy.mockRestore();
    expect(out).toContain('mini todo add');
  });

  it('does nothing without a project', async () => {
    await rm(join(cwd, '.mini'), { recursive: true, force: true });
    await todo('add', ['ignored']);
    expect(await readTodos(cwd)).toEqual([]);
  });
});
