import { type CommandSpec, isShell, renderCompletion, SHELLS } from '../completion/render.js';

/**
 * Prints a shell completion script for `mini` to stdout. The commands and their
 * flags are passed in by the caller (derived from commander) so the completion
 * always matches the real CLI.
 *
 * @returns `true` on success, `false` for an unsupported shell (the caller then
 *   exits non-zero).
 */
export function completion(shell: string, commands: CommandSpec[]): boolean {
  if (!isShell(shell)) {
    console.error(`Unknown shell "${shell}". Supported: ${SHELLS.join(', ')}.`);
    return false;
  }
  const script = renderCompletion(shell, { binName: 'mini', commands });
  process.stdout.write(script.endsWith('\n') ? script : `${script}\n`);
  return true;
}
