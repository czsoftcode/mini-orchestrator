import { spawn } from 'node:child_process';
import { describeSpawnError } from './spawnError.js';
export async function workWithClaude(prompt, opts = {}) {
    const args = [];
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
            stdio: 'inherit',
        });
        proc.on('error', (err) => {
            reject(describeSpawnError(err));
        });
        proc.on('close', (code) => {
            resolve({ exitCode: code ?? 0 });
        });
    });
}
