import { spawn } from 'node:child_process';

import type { PermissionMode } from './work.js';

export interface StreamOptions {
  cwd?: string;
  model?: string;
  allowedTools?: string[];
  permissionMode?: PermissionMode;
  maxTurns?: number;
  onEvent?: (event: StreamEvent) => void;
  onParseError?: (line: string, err: Error) => void;
}

export interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface StreamResult {
  exitCode: number;
  sessionId?: string;
  costUsd?: number;
  usage?: StreamUsage;
  durationMs?: number;
  numTurns?: number;
  resultText?: string;
  isError?: boolean;
}

export type StreamEvent =
  | SystemInitEvent
  | AssistantEvent
  | UserEvent
  | ResultEvent
  | UnknownEvent;

export interface SystemInitEvent {
  kind: 'system-init';
  sessionId?: string;
  model?: string;
  tools?: string[];
  cwd?: string;
  raw: RawEnvelope;
}

export interface AssistantEvent {
  kind: 'assistant';
  textParts: string[];
  toolUses: ToolUse[];
  sessionId?: string;
  raw: RawEnvelope;
}

export interface UserEvent {
  kind: 'user';
  toolResults: ToolResult[];
  sessionId?: string;
  raw: RawEnvelope;
}

export interface ResultEvent {
  kind: 'result';
  sessionId?: string;
  costUsd?: number;
  usage?: StreamUsage;
  durationMs?: number;
  numTurns?: number;
  resultText?: string;
  isError?: boolean;
  raw: RawEnvelope;
}

export interface UnknownEvent {
  kind: 'unknown';
  type: string;
  raw: RawEnvelope;
}

export interface ToolUse {
  id?: string;
  name: string;
  input?: unknown;
}

export interface ToolResult {
  toolUseId?: string;
  isError?: boolean;
  contentPreview?: string;
}

export type RawEnvelope = Record<string, unknown>;

/**
 * Parsuje jednu NDJSON řádku ze stream-json výstupu Claude Code.
 * Vrací null pro prázdné řádky. Hází výjimku jen na nevalidní JSON.
 */
export function parseStreamEvent(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const raw = JSON.parse(trimmed) as RawEnvelope;
  return mapEnvelope(raw);
}

function mapEnvelope(raw: RawEnvelope): StreamEvent {
  const type = typeof raw.type === 'string' ? raw.type : '';
  const sessionId = typeof raw.session_id === 'string' ? raw.session_id : undefined;

  if (type === 'system') {
    const subtype = typeof raw.subtype === 'string' ? raw.subtype : '';
    if (subtype === 'init') {
      return {
        kind: 'system-init',
        sessionId,
        model: typeof raw.model === 'string' ? raw.model : undefined,
        tools: Array.isArray(raw.tools) ? raw.tools.filter((t): t is string => typeof t === 'string') : undefined,
        cwd: typeof raw.cwd === 'string' ? raw.cwd : undefined,
        raw,
      };
    }
  }

  if (type === 'assistant') {
    const message = isObject(raw.message) ? raw.message : undefined;
    const content = message && Array.isArray(message.content) ? message.content : [];
    const textParts: string[] = [];
    const toolUses: ToolUse[] = [];
    for (const block of content) {
      if (!isObject(block)) continue;
      const blockType = typeof block.type === 'string' ? block.type : '';
      if (blockType === 'text' && typeof block.text === 'string') {
        textParts.push(block.text);
      } else if (blockType === 'tool_use') {
        toolUses.push({
          id: typeof block.id === 'string' ? block.id : undefined,
          name: typeof block.name === 'string' ? block.name : '(unknown)',
          input: block.input,
        });
      }
    }
    return {
      kind: 'assistant',
      textParts,
      toolUses,
      sessionId,
      raw,
    };
  }

  if (type === 'user') {
    const message = isObject(raw.message) ? raw.message : undefined;
    const content = message && Array.isArray(message.content) ? message.content : [];
    const toolResults: ToolResult[] = [];
    for (const block of content) {
      if (!isObject(block)) continue;
      const blockType = typeof block.type === 'string' ? block.type : '';
      if (blockType === 'tool_result') {
        toolResults.push({
          toolUseId: typeof block.tool_use_id === 'string' ? block.tool_use_id : undefined,
          isError: typeof block.is_error === 'boolean' ? block.is_error : undefined,
          contentPreview: extractContentPreview(block.content),
        });
      }
    }
    return {
      kind: 'user',
      toolResults,
      sessionId,
      raw,
    };
  }

  if (type === 'result') {
    const usage = isObject(raw.usage) ? mapUsage(raw.usage) : undefined;
    return {
      kind: 'result',
      sessionId,
      costUsd: typeof raw.total_cost_usd === 'number' ? raw.total_cost_usd : undefined,
      usage,
      durationMs: typeof raw.duration_ms === 'number' ? raw.duration_ms : undefined,
      numTurns: typeof raw.num_turns === 'number' ? raw.num_turns : undefined,
      resultText: typeof raw.result === 'string' ? raw.result : undefined,
      isError: typeof raw.is_error === 'boolean' ? raw.is_error : undefined,
      raw,
    };
  }

  return { kind: 'unknown', type, raw };
}

function mapUsage(u: RawEnvelope): StreamUsage {
  return {
    inputTokens: typeof u.input_tokens === 'number' ? u.input_tokens : 0,
    outputTokens: typeof u.output_tokens === 'number' ? u.output_tokens : 0,
    cacheReadTokens: typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : 0,
    cacheCreationTokens: typeof u.cache_creation_input_tokens === 'number' ? u.cache_creation_input_tokens : 0,
  };
}

function extractContentPreview(content: unknown): string | undefined {
  if (typeof content === 'string') {
    return content.length > 200 ? `${content.slice(0, 200)}…` : content;
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (isObject(block) && typeof block.text === 'string') {
        const t = block.text;
        return t.length > 200 ? `${t.slice(0, 200)}…` : t;
      }
    }
  }
  return undefined;
}

function isObject(value: unknown): value is RawEnvelope {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Rozdělí postupně přicházející chunky stdoutu na celé NDJSON řádky.
 * Vrací callback `push(chunk)`, který volá `onLine` pro každou kompletní řádku,
 * a `flush()`, který vyplaví zbývající nedokončenou řádku (pokud nějaká je).
 */
export function createLineBuffer(onLine: (line: string) => void): {
  push: (chunk: string) => void;
  flush: () => void;
} {
  let buf = '';
  return {
    push(chunk: string): void {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        onLine(line);
      }
    },
    flush(): void {
      if (buf.length > 0) {
        onLine(buf);
        buf = '';
      }
    },
  };
}

export async function streamWithClaude(prompt: string, opts: StreamOptions = {}): Promise<StreamResult> {
  const args: string[] = ['-p', '--output-format', 'stream-json', '--verbose'];

  if (opts.allowedTools && opts.allowedTools.length > 0) {
    args.push('--allowed-tools', opts.allowedTools.join(','));
  }
  if (opts.permissionMode) {
    args.push('--permission-mode', opts.permissionMode);
  }
  if (opts.model) {
    args.push('--model', opts.model);
  }
  if (opts.maxTurns !== undefined) {
    args.push('--max-turns', String(opts.maxTurns));
  }
  args.push('--', prompt);

  return new Promise<StreamResult>((resolve, reject) => {
    const proc = spawn('claude', args, {
      cwd: opts.cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let finalResult: ResultEvent | null = null;
    let lastSessionId: string | undefined;

    const handleLine = (line: string): void => {
      let event: StreamEvent | null;
      try {
        event = parseStreamEvent(line);
      } catch (err) {
        opts.onParseError?.(line, err as Error);
        return;
      }
      if (!event) return;
      if ('sessionId' in event && event.sessionId) {
        lastSessionId = event.sessionId;
      }
      if (event.kind === 'result') {
        finalResult = event;
      }
      opts.onEvent?.(event);
    };

    const buffer = createLineBuffer(handleLine);

    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', (chunk: string) => {
      buffer.push(chunk);
    });

    proc.stderr.setEncoding('utf-8');
    proc.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Nepodařilo se spustit claude: ${err.message}`));
    });

    proc.on('close', (code: number | null) => {
      buffer.flush();
      const exitCode = code ?? 0;
      if (exitCode !== 0 && finalResult === null) {
        const tail = stderr.trim().slice(-500);
        reject(new Error(`claude skončil s kódem ${exitCode}${tail ? `. ${tail}` : '.'}`));
        return;
      }
      const r = finalResult as ResultEvent | null;
      resolve({
        exitCode,
        sessionId: r?.sessionId ?? lastSessionId,
        costUsd: r?.costUsd,
        usage: r?.usage,
        durationMs: r?.durationMs,
        numTurns: r?.numTurns,
        resultText: r?.resultText,
        isError: r?.isError,
      });
    });
  });
}
