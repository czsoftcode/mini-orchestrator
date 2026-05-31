/**
 * Is the current process attached to an interactive terminal (TTY)?
 *
 * Auto mode asks a human at items for manual verification even without the
 * `--auto` prompt (verify is intentionally never bypassed). But without a TTY
 * (CI, pipe, missing terminal) `prompts` returns `undefined` and the answer is
 * evaluated as `pass` — the phase would silently close without real
 * verification. So we check interactivity first and behave safely in a
 * non-interactive environment (we do not close the phase).
 *
 * Extracted into its own module so the behavior can be mocked in tests.
 */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
