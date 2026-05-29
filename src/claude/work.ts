import { spawn } from 'node:child_process';

/**
 * mini řídí Claude jen v režimu `acceptEdits` (jinak nechá `permissionMode`
 * nevyplněný = ptej se). CLI zná i další módy (`plan`, `bypassPermissions`,
 * `default`, …), ale mini je nikdy nepředává, tak je typ zúžený na reálně
 * používanou hodnotu. Až bude potřeba další, dopiš ji sem.
 */
export type PermissionMode = 'acceptEdits';

export interface WorkOptions {
  cwd?: string;
  model?: string;
  allowedTools?: string[];
  permissionMode?: PermissionMode;
  maxTurns?: number;
}

export interface WorkResult {
  exitCode: number;
}

export async function workWithClaude(prompt: string, opts: WorkOptions = {}): Promise<WorkResult> {
  const args: string[] = [];

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

  return new Promise<WorkResult>((resolve, reject) => {
    const proc = spawn('claude', args, {
      cwd: opts.cwd ?? process.cwd(),
      stdio: 'inherit',
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Nepodařilo se spustit claude: ${err.message}`));
    });

    proc.on('close', (code: number | null) => {
      resolve({ exitCode: code ?? 0 });
    });
  });
}
