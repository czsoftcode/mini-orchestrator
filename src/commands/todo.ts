import { exists } from '../state/store.js';
import { type TodoItem, readTodos, writeTodos } from '../state/todoStore.js';
import { log } from '../ui/log.js';

/**
 * `mini todo` — the project's ideas/changes archive (`.mini/todo.md`).
 *
 * Non-interactive and TTY-free, so it works the same from a terminal and from
 * the `/mini:todo` slash command in Claude Code:
 *
 * - `mini todo`              — lists the items (numbered, open/done)
 * - `mini todo add <text>`   — appends a new open item
 * - `mini todo done <n>`     — ticks item number `n` off
 * - `mini todo remove <n>`   — drops item number `n` (alias `rm`)
 *
 * The `mini next` prompt surfaces the open items as candidate phase ideas.
 */
export async function todo(action?: string, args: string[] = []): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('There is no project in this directory.');
    return;
  }

  const items = await readTodos(cwd);

  switch ((action ?? 'list').toLowerCase()) {
    case 'list':
      list(items);
      return;
    case 'add':
      await add(items, args, cwd);
      return;
    case 'done':
      await setDone(items, args, cwd);
      return;
    case 'remove':
    case 'rm':
      await remove(items, args, cwd);
      return;
    case 'edit':
      await edit(items, args, cwd);
      return;
    case 'clear':
      await clearDone(items, cwd);
      return;
    default:
      log.warn(
        `Unknown action "${action}". Use: list | add <text> | edit <n> <text> | done <n> | remove <n> | clear.`,
      );
  }
}

function list(items: TodoItem[]): void {
  if (items.length === 0) {
    log.info('The todo archive is empty. Add an idea with `mini todo add "<text>"`.');
    return;
  }
  const width = String(items.length).length;
  log.title('Ideas & changes');
  items.forEach((it, i) => {
    const num = String(i + 1).padStart(width, ' ');
    log.info(`  ${num}. [${it.done ? 'x' : ' '}] ${it.text}`);
  });
  const open = items.filter((it) => !it.done).length;
  log.hint(`${open} open / ${items.length} total`);
  log.hint('Actions: list · add "<text>" · edit <n> "<text>" · done <n> · remove <n> · clear');
}

async function add(items: TodoItem[], args: string[], cwd: string): Promise<void> {
  const text = args.join(' ').trim();
  if (!text) {
    log.warn('Nothing to add. Usage: `mini todo add "<text>"`.');
    return;
  }
  items.push({ text, done: false });
  await writeTodos(items, cwd);
  log.success(`Added: ${text}`);
}

async function setDone(items: TodoItem[], args: string[], cwd: string): Promise<void> {
  const idx = parseIndex(args[0], items.length);
  if (idx === null) return;
  const item = items[idx];
  if (!item) return;
  if (item.done) {
    log.info(`Item ${idx + 1} is already done.`);
    return;
  }
  item.done = true;
  await writeTodos(items, cwd);
  log.success(`Done: ${item.text}`);
}

async function remove(items: TodoItem[], args: string[], cwd: string): Promise<void> {
  const idx = parseIndex(args[0], items.length);
  if (idx === null) return;
  const [removed] = items.splice(idx, 1);
  if (!removed) return;
  await writeTodos(items, cwd);
  log.success(`Removed: ${removed.text}`);
}

async function edit(items: TodoItem[], args: string[], cwd: string): Promise<void> {
  const idx = parseIndex(args[0], items.length);
  if (idx === null) return;
  const item = items[idx];
  if (!item) return;
  const text = args.slice(1).join(' ').trim();
  if (!text) {
    log.warn('Nothing to set. Usage: `mini todo edit <n> "<text>"`.');
    return;
  }
  item.text = text;
  await writeTodos(items, cwd);
  log.success(`Edited ${idx + 1}: ${text}`);
}

/** Drops every ticked-off item, keeping only the open ones. */
async function clearDone(items: TodoItem[], cwd: string): Promise<void> {
  const kept = items.filter((it) => !it.done);
  const removed = items.length - kept.length;
  if (removed === 0) {
    log.info('No done items to clear.');
    return;
  }
  await writeTodos(kept, cwd);
  log.success(`Cleared ${removed} done item${removed === 1 ? '' : 's'}.`);
}

/** Parses a 1-based index argument and validates the range; warns on failure. */
function parseIndex(arg: string | undefined, count: number): number | null {
  const n = Number(arg);
  if (!arg || !Number.isInteger(n) || n < 1 || n > count) {
    log.warn(
      count === 0
        ? 'The todo archive is empty — nothing to reference.'
        : `Give an item number between 1 and ${count}.`,
    );
    return null;
  }
  return n - 1;
}
