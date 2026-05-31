import pc from 'picocolors';

import type { StreamEvent, ToolUse } from '../claude/stream.js';

import { log } from './log.js';

export interface StreamRenderer {
  /** Pass every stream event to this method (`streamWithClaude` calls it via `onEvent`). */
  onEvent: (event: StreamEvent) => void;
}

/**
 * Creates a renderer that prints, live, what Claude is currently doing:
 * - "system-init" → a short header with the model and working directory,
 * - "assistant"   → text (truncated to the first line) and each used tool as "→ Name argument",
 * - "user"        → only failed tool results (successful ones are silent — the next assistant step follows),
 * - "result"      → ignored (the final summary is rendered by another piece of UI),
 * - "unknown"     → ignored.
 *
 * The renderer holds state (id → tool name mapping), so it is a factory, not a pure function.
 */
export function createStreamRenderer(): StreamRenderer {
  const toolNamesById = new Map<string, string>();

  return {
    onEvent(event: StreamEvent): void {
      switch (event.kind) {
        case 'system-init': {
          const parts: string[] = [];
          if (event.model) {
            parts.push(`model: ${event.model}`);
          }
          if (event.cwd) {
            parts.push(`cwd: ${event.cwd}`);
          }
          const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
          log.dim(`Claude session started${detail}.`);
          // A blank line separates the session header from the stream of actions that follows.
          console.log();
          return;
        }

        case 'assistant': {
          for (const text of event.textParts) {
            const preview = previewText(text);
            if (preview) {
              console.log(`${pc.dim('…')} ${pc.dim(preview)}`);
            }
          }
          for (const tool of event.toolUses) {
            if (tool.id) {
              toolNamesById.set(tool.id, tool.name);
            }
            console.log(`${pc.cyan('→')} ${formatToolUse(tool)}`);
          }
          return;
        }

        case 'user': {
          for (const result of event.toolResults) {
            if (!result.isError) {
              continue;
            }
            const name = result.toolUseId ? toolNamesById.get(result.toolUseId) : undefined;
            const label = name ? `${name} failed` : 'tool failed';
            const tail = result.contentPreview ? `: ${shorten(result.contentPreview)}` : '';
            console.log(`${pc.red('  ↳')} ${label}${tail}`);
          }
          return;
        }

        case 'result':
        case 'unknown':
          return;
      }
    },
  };
}

function previewText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const firstLine = trimmed.split('\n')[0] ?? '';
  return shorten(firstLine, 120);
}

function formatToolUse(tool: ToolUse): string {
  const name = pc.bold(tool.name);
  const arg = formatToolInput(tool);
  return arg ? `${name} ${pc.dim(arg)}` : name;
}

function formatToolInput(tool: ToolUse): string {
  if (!tool.input || typeof tool.input !== 'object' || Array.isArray(tool.input)) {
    return '';
  }
  const obj = tool.input as Record<string, unknown>;

  // Named arguments that make the most sense for common tools.
  const named =
    pickString(obj, 'file_path') ??
    pickString(obj, 'path') ??
    pickString(obj, 'command') ??
    pickString(obj, 'pattern') ??
    pickString(obj, 'url') ??
    pickString(obj, 'query') ??
    pickString(obj, 'prompt') ??
    pickString(obj, 'description');
  if (named) {
    return shorten(named);
  }

  // Otherwise show the first string value, so we have at least something.
  for (const value of Object.values(obj)) {
    if (typeof value === 'string' && value.length > 0) {
      return shorten(value);
    }
  }
  return '';
}

function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function shorten(value: string, max = 80): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
