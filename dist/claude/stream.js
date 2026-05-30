import { spawn } from 'node:child_process';
import { describeSpawnError } from './spawnError.js';
/**
 * Parsuje jednu NDJSON řádku ze stream-json výstupu Claude Code.
 * Vrací null pro prázdné řádky. Hází výjimku jen na nevalidní JSON.
 */
export function parseStreamEvent(line) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const raw = JSON.parse(trimmed);
    return mapEnvelope(raw);
}
function mapEnvelope(raw) {
    const type = typeof raw.type === 'string' ? raw.type : '';
    const sessionId = typeof raw.session_id === 'string' ? raw.session_id : undefined;
    if (type === 'system') {
        const subtype = typeof raw.subtype === 'string' ? raw.subtype : '';
        if (subtype === 'init') {
            return {
                kind: 'system-init',
                sessionId,
                model: typeof raw.model === 'string' ? raw.model : undefined,
                tools: Array.isArray(raw.tools) ? raw.tools.filter((t) => typeof t === 'string') : undefined,
                cwd: typeof raw.cwd === 'string' ? raw.cwd : undefined,
                raw,
            };
        }
    }
    if (type === 'assistant') {
        const message = isObject(raw.message) ? raw.message : undefined;
        const content = message && Array.isArray(message.content) ? message.content : [];
        const textParts = [];
        const toolUses = [];
        for (const block of content) {
            if (!isObject(block))
                continue;
            const blockType = typeof block.type === 'string' ? block.type : '';
            if (blockType === 'text' && typeof block.text === 'string') {
                textParts.push(block.text);
            }
            else if (blockType === 'tool_use') {
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
        const toolResults = [];
        for (const block of content) {
            if (!isObject(block))
                continue;
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
function mapUsage(u) {
    return {
        inputTokens: typeof u.input_tokens === 'number' ? u.input_tokens : 0,
        outputTokens: typeof u.output_tokens === 'number' ? u.output_tokens : 0,
        cacheReadTokens: typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : 0,
        cacheCreationTokens: typeof u.cache_creation_input_tokens === 'number' ? u.cache_creation_input_tokens : 0,
    };
}
function extractContentPreview(content) {
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
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Rozdělí postupně přicházející chunky stdoutu na celé NDJSON řádky.
 * Vrací callback `push(chunk)`, který volá `onLine` pro každou kompletní řádku,
 * a `flush()`, který vyplaví zbývající nedokončenou řádku (pokud nějaká je).
 */
export function createLineBuffer(onLine) {
    let buf = '';
    return {
        push(chunk) {
            buf += chunk;
            let idx;
            while ((idx = buf.indexOf('\n')) !== -1) {
                const line = buf.slice(0, idx);
                buf = buf.slice(idx + 1);
                onLine(line);
            }
        },
        flush() {
            if (buf.length > 0) {
                onLine(buf);
                buf = '';
            }
        },
    };
}
export async function streamWithClaude(prompt, opts = {}) {
    const args = ['-p', '--output-format', 'stream-json', '--verbose'];
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
    return new Promise((resolve, reject) => {
        const proc = spawn('claude', args, {
            cwd: opts.cwd ?? process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        let finalResult = null;
        let lastSessionId;
        const handleLine = (line) => {
            let event;
            try {
                event = parseStreamEvent(line);
            }
            catch (err) {
                opts.onParseError?.(line, err);
                return;
            }
            if (!event)
                return;
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
        proc.stdout.on('data', (chunk) => {
            buffer.push(chunk);
        });
        proc.stderr.setEncoding('utf-8');
        proc.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        proc.on('error', (err) => {
            reject(describeSpawnError(err));
        });
        proc.on('close', (code) => {
            buffer.flush();
            const exitCode = code ?? 0;
            if (exitCode !== 0 && finalResult === null) {
                const tail = stderr.trim().slice(-500);
                reject(new Error(`claude skončil s kódem ${exitCode}${tail ? `. ${tail}` : '.'}`));
                return;
            }
            const r = finalResult;
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
