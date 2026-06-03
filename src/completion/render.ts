/**
 * Generates shell completion scripts for the `mini` CLI. The renderers are pure
 * (string in, string out) so they can be snapshot-tested; the actual command
 * list is passed in by the caller, which derives it from commander at runtime so
 * the completion never drifts from the real set of commands.
 */

/** Shells we can emit a completion script for. */
export const SHELLS = ['bash', 'zsh'] as const;
export type Shell = (typeof SHELLS)[number];

/** Type guard: is `value` one of the supported shells? */
export function isShell(value: string): value is Shell {
  return (SHELLS as readonly string[]).includes(value);
}

export interface CompletionSpec {
  /** The binary name the completion is registered for (e.g. `mini`). */
  binName: string;
  /** Top-level command names to complete (e.g. `["init", "next", …]`). */
  commands: string[];
}

/** Renders the completion script for the given shell. */
export function renderCompletion(shell: Shell, spec: CompletionSpec): string {
  return shell === 'bash' ? renderBash(spec) : renderZsh(spec);
}

/**
 * Bash completion. Deliberately self-contained — it does not depend on the
 * bash-completion package: the first word after the binary completes a command
 * name, anything further falls back to filename completion.
 */
function renderBash({ binName, commands }: CompletionSpec): string {
  const fn = `_${binName}_completion`;
  const list = commands.join(' ');
  return `# bash completion for ${binName}
# Enable with: source <(${binName} completion bash)
${fn}() {
  local cur cword
  cur="\${COMP_WORDS[COMP_CWORD]}"
  cword=\${COMP_CWORD}
  local commands="${list}"
  if [ "\${cword}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi
  COMPREPLY=( $(compgen -f -- "\${cur}") )
  return 0
}
complete -F ${fn} ${binName}
`;
}

/**
 * Zsh completion. The leading `#compdef` line is a no-op when the script is
 * sourced via `source <(mini completion zsh)`, so the trailing `compdef` call
 * registers the function explicitly. Command names are completed first, then it
 * falls back to file completion.
 */
function renderZsh({ binName, commands }: CompletionSpec): string {
  const fn = `_${binName}`;
  const list = commands.join(' ');
  return `#compdef ${binName}
# zsh completion for ${binName}
# Enable with: source <(${binName} completion zsh)
${fn}() {
  local -a commands
  commands=(${list})
  if (( CURRENT == 2 )); then
    compadd -- \${commands}
    return
  fi
  _files
}
compdef ${fn} ${binName}
`;
}
