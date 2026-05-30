import pc from 'picocolors';
import { log } from './log.js';
/**
 * Vytvoří renderer, který průběžně tiskne, co Claude právě dělá:
 * - "system-init" → krátká hlavička s modelem a pracovním adresářem,
 * - "assistant"   → text (zkrácený na první řádek) a každý použitý nástroj jako "→ Name argument",
 * - "user"        → jen chybné výsledky nástrojů (úspěšné jsou ticho — následuje další asistentův krok),
 * - "result"      → ignoruje (závěrečný souhrn vykreslí jiný kus UI),
 * - "unknown"     → ignoruje.
 *
 * Renderer si drží stav (mapování id → název nástroje), proto jde o factory, ne čistou funkci.
 */
export function createStreamRenderer() {
    const toolNamesById = new Map();
    return {
        onEvent(event) {
            switch (event.kind) {
                case 'system-init': {
                    const parts = [];
                    if (event.model) {
                        parts.push(`model: ${event.model}`);
                    }
                    if (event.cwd) {
                        parts.push(`cwd: ${event.cwd}`);
                    }
                    const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
                    log.dim(`Claude session spuštěna${detail}.`);
                    // Prázdný řádek odděluje hlavičku session od proudu akcí, který následuje.
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
                        const label = name ? `${name} selhal` : 'nástroj selhal';
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
function previewText(text) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return '';
    }
    const firstLine = trimmed.split('\n')[0] ?? '';
    return shorten(firstLine, 120);
}
function formatToolUse(tool) {
    const name = pc.bold(tool.name);
    const arg = formatToolInput(tool);
    return arg ? `${name} ${pc.dim(arg)}` : name;
}
function formatToolInput(tool) {
    if (!tool.input || typeof tool.input !== 'object' || Array.isArray(tool.input)) {
        return '';
    }
    const obj = tool.input;
    // Pojmenované argumenty, které dávají nejlepší smysl pro běžné nástroje.
    const named = pickString(obj, 'file_path') ??
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
    // Jinak ukaž první stringovou hodnotu, ať máme aspoň něco.
    for (const value of Object.values(obj)) {
        if (typeof value === 'string' && value.length > 0) {
            return shorten(value);
        }
    }
    return '';
}
function pickString(obj, key) {
    const value = obj[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
function shorten(value, max = 80) {
    const oneLine = value.replace(/\s+/g, ' ').trim();
    return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
