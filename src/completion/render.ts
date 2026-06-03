/**
 * Generates shell completion scripts for the `mini` CLI. The renderers are pure
 * (string in, string out) so they can be snapshot-tested; the command list and
 * each command's flags are passed in by the caller, which derives them from
 * commander at runtime so the completion never drifts from the real CLI.
 */

/** Shells we can emit a completion script for. */
export const SHELLS = ['bash', 'zsh'] as const;
export type Shell = (typeof SHELLS)[number];

/** Type guard: is `value` one of the supported shells? */
export function isShell(value: string): value is Shell {
  return (SHELLS as readonly string[]).includes(value);
}

export interface CommandSpec {
  /** The command name (e.g. `done`). */
  name: string;
  /** Its option flags in `--long`/`-s` form (e.g. `["--apply", "--bump"]`). */
  flags: string[];
}

export interface CompletionSpec {
  /** The binary name the completion is registered for (e.g. `mini`). */
  binName: string;
  /** Top-level commands to complete, each with its option flags. */
  commands: CommandSpec[];
}

/** Renders the completion script for the given shell. */
export function renderCompletion(shell: Shell, spec: CompletionSpec): string {
  return shell === 'bash' ? renderBash(spec) : renderZsh(spec);
}

/** Commands that actually carry flags, in the order they were given. */
function withFlags(commands: CommandSpec[]): CommandSpec[] {
  return commands.filter((c) => c.flags.length > 0);
}

/**
 * Bash completion. Deliberately self-contained — it does not depend on the
 * bash-completion package: the first word after the binary completes a command
 * name, a word starting with `-` completes that command's flags, anything else
 * falls back to filename completion.
 */
function renderBash({ binName, commands }: CompletionSpec): string {
  const fn = `_${binName}_completion`;
  const names = commands.map((c) => c.name).join(' ');
  const branches = withFlags(commands)
    .map((c) => `      ${c.name}) flags="${c.flags.join(' ')}" ;;`)
    .join('\n');
  return `# bash completion for ${binName}
# Enable with: source <(${binName} completion bash)
${fn}() {
  local cur cword cmd flags
  cur="\${COMP_WORDS[COMP_CWORD]}"
  cword=\${COMP_CWORD}
  local commands="${names}"
  if [ "\${cword}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi
  if [[ "\${cur}" == -* ]]; then
    cmd="\${COMP_WORDS[1]}"
    flags=""
    case "\${cmd}" in
${branches}
    esac
    COMPREPLY=( $(compgen -W "\${flags}" -- "\${cur}") )
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
 * registers the function explicitly. Command names are completed first, a word
 * starting with `-` completes that command's flags, then it falls back to file
 * completion.
 */
function renderZsh({ binName, commands }: CompletionSpec): string {
  const fn = `_${binName}`;
  const names = commands.map((c) => c.name).join(' ');
  const branches = withFlags(commands)
    .map((c) => `      ${c.name}) flags=(${c.flags.join(' ')}) ;;`)
    .join('\n');
  return `#compdef ${binName}
# zsh completion for ${binName}
# Enable with: source <(${binName} completion zsh)
${fn}() {
  local -a commands flags
  commands=(${names})
  if (( CURRENT == 2 )); then
    compadd -- \${commands}
    return
  fi
  if [[ \${words[CURRENT]} == -* ]]; then
    case \${words[2]} in
${branches}
    esac
    compadd -- \${flags}
    return
  fi
  _files
}
compdef ${fn} ${binName}
`;
}
