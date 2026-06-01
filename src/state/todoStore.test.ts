import { describe, expect, it } from 'vitest';
import { type TodoItem, parseTodos, serializeTodos } from './todoStore.js';

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
