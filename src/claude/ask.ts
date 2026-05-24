import { spawn } from 'node:child_process';
import type { PermissionMode } from './work.js';

export interface AskOptions {
  cwd?: string;
  timeoutMs?: number;
  allowedTools?: string[];
  appendSystemPrompt?: string;
  model?: string;
  permissionMode?: PermissionMode;
}

export interface AskUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface AskResult {
  text: string;
  usage?: AskUsage;
  sessionId?: string;
  costUsd?: number;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

interface ClaudeJsonResult {
  type: string;
  is_error: boolean;
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export async function askClaude(prompt: string, opts: AskOptions = {}): Promise<AskResult> {
  const args: string[] = ['-p', '--output-format', 'json'];

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

  return new Promise<AskResult>((resolve, reject) => {
    const proc = spawn('claude', args, {
      cwd: opts.cwd ?? process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin.write(prompt);
    proc.stdin.end();

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Claude přestal odpovídat (timeout ${timeoutMs} ms).`));
    }, timeoutMs);

    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(new Error(`Nepodařilo se spustit claude: ${err.message}`));
    });

    proc.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (code !== 0) {
        const tail = stderr.trim().slice(-500) || stdout.trim().slice(-500);
        reject(new Error(`claude skončil s kódem ${code}. ${tail}`));
        return;
      }
      try {
        const json = JSON.parse(stdout) as ClaudeJsonResult;
        if (json.is_error) {
          reject(new Error(`Claude vrátil chybu: ${json.result ?? '(bez detailu)'}`));
          return;
        }
        const result: AskResult = {
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
      } catch (err) {
        reject(new Error(`Nepodařilo se zpracovat odpověď claude: ${(err as Error).message}`));
      }
    });
  });
}
