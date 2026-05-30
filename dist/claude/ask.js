import { spawn } from 'node:child_process';
import { describeSpawnError } from './spawnError.js';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
export async function askClaude(prompt, opts = {}) {
    const args = ['-p', '--output-format', 'json'];
    if (opts.allowedTools && opts.allowedTools.length > 0) {
        args.push('--allowed-tools', opts.allowedTools.join(','));
    }
    if (opts.appendSystemPrompt) {
        args.push('--append-system-prompt', opts.appendSystemPrompt);
    }
    if (opts.model) {
        args.push('--model', opts.model);
    }
    if (opts.permissionMode) {
        args.push('--permission-mode', opts.permissionMode);
    }
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
        const proc = spawn('claude', args, {
            cwd: opts.cwd ?? process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        proc.stdin.write(prompt);
        proc.stdin.end();
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (chunk) => {
            stdout += chunk.toString('utf-8');
        });
        proc.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf-8');
        });
        const timer = setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error(`Claude přestal odpovídat (timeout ${timeoutMs} ms).`));
        }, timeoutMs);
        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(describeSpawnError(err));
        });
        proc.on('close', (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                const tail = stderr.trim().slice(-500) || stdout.trim().slice(-500);
                reject(new Error(`claude skončil s kódem ${code}. ${tail}`));
                return;
            }
            try {
                const json = JSON.parse(stdout);
                if (json.is_error) {
                    reject(new Error(`Claude vrátil chybu: ${json.result ?? '(bez detailu)'}`));
                    return;
                }
                const result = {
                    text: (json.result ?? '').trim(),
                };
                if (json.session_id) {
                    result.sessionId = json.session_id;
                }
                if (typeof json.total_cost_usd === 'number') {
                    result.costUsd = json.total_cost_usd;
                }
                if (json.usage) {
                    result.usage = {
                        inputTokens: json.usage.input_tokens ?? 0,
                        outputTokens: json.usage.output_tokens ?? 0,
                        cacheReadTokens: json.usage.cache_read_input_tokens ?? 0,
                        cacheCreationTokens: json.usage.cache_creation_input_tokens ?? 0,
                    };
                }
                resolve(result);
            }
            catch (err) {
                reject(new Error(`Nepodařilo se zpracovat odpověď claude: ${err.message}`));
            }
        });
    });
}
