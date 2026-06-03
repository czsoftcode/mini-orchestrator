/**
 * Generates shell completion scripts for the `mini` CLI. The renderers are pure
 * (string in, string out) so they can be snapshot-tested; the command list,
 * each command's flags and any flags' enumerated values are passed in by the
 * caller, which derives them from commander at runtime so the completion never
 * drifts from the real CLI.
 */

/** Shells we can emit a completion script for. */
export const SHELLS = ['bash', 'zsh'] as const;
export type Shell = (typeof SHELLS)[number];

/** Type guard: is `value` one of the supported shells? */
export function isShell(value: string): value is Shell {
  return (SHELLS as readonly string[]).includes(value);
}

export interface FlagSpec {
  /** The flag in `--long`/`-s` form (e.g. `--bump`). */
  name: string;
  /** Enumerated values the flag accepts (e.g. `["none", "patch", …]`), if any. */
  values?: string[];
}

export interface CommandSpec {
  /** The command name (e.g. `done`). */
  name: string;
  /** Its option flags. */
  flags: FlagSpec[];
}

export interface CompletionSpec {
  /** The binary name the completion is registered for (e.g. `mini`). */
  binName: string;
  /** Top-level commands to complete, each with its flags. */
  commands: CommandSpec[];
}

/** Renders the completion script for the given shell. */
export function renderCompletion(shell: Shell, spec: CompletionSpec): string {
  return shell === 'bash' ? renderBash(spec) : renderZsh(spec);
}

/** Commands that have at least one flag, in the order they were given. */
function withFlags(commands: CommandSpec[]): CommandSpec[] {
  return commands.filter((c) => c.flags.length > 0);
}

/** `(command, flag)` pairs whose flag carries enumerated values. */
function valuePairs(commands: CommandSpec[]): { cmd: string; flag: string; values: string[] }[] {
  return commands.flatMap((c) =>
    c.flags
      .filter((f) => f.values && f.values.length > 0)
      .map((f) => ({ cmd: c.name, flag: f.name, values: f.values as string[] })),
  );
}

/**
 * Bash completion. Deliberately self-contained — it does not depend on the
 * bash-completion package. Order: when the previous word is a flag with a known
 * value set, complete those values; else the first word completes a command
 * name, a word starting with `-` completes that command's flags, anything else
 * falls back to filename completion.
 */
function renderBash({ binName, commands }: CompletionSpec): string {
  const fn = `_${binName}_completion`;
  const names = commands.map((c) => c.name).join(' ');
  const valueBranches = valuePairs(commands)
    .map(
      (p) =>
        `      ${p.cmd}:${p.flag}) COMPREPLY=( $(compgen -W "${p.values.join(' ')}" -- "\${cur}") ); return 0 ;;`,
    )
    .join('\n');
  const flagBranches = withFlags(commands)
    .map((c) => `      ${c.name}) flags="${c.flags.map((f) => f.name).join(' ')}" ;;`)
    .join('\n');
  return `# bash completion for ${binName}
# Enable with: source <(${binName} completion bash)
${fn}() {
  local cur prev cword cmd flags
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  cword=\${COMP_CWORD}
  local commands="${names}"
  if [ "\${cword}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi
  cmd="\${COMP_WORDS[1]}"
  case "\${cmd}:\${prev}" in
${valueBranches}
  esac
  if [[ "\${cur}" == -* ]]; then
    flags=""
    case "\${cmd}" in
${flagBranches}
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
 * registers the function explicitly. Same order as bash: flag values first, then
 * command names, then a command's flags, then file completion.
 */
function renderZsh({ binName, commands }: CompletionSpec): string {
  const fn = `_${binName}`;
  const names = commands.map((c) => c.name).join(' ');
  const valueBranches = valuePairs(commands)
    .map((p) => `      ${p.cmd}:${p.flag}) compadd -- ${p.values.join(' ')}; return ;;`)
    .join('\n');
  const flagBranches = withFlags(commands)
    .map((c) => `      ${c.name}) flags=(${c.flags.map((f) => f.name).join(' ')}) ;;`)
    .join('\n');
  return `#compdef ${binName}
# zsh completion for ${binName}
# Enable with: source <(${binName} completion zsh)
${fn}() {
  local -a commands flags
  local cmd prev
  commands=(${names})
  if (( CURRENT == 2 )); then
    compadd -- \${commands}
    return
  fi
  cmd=\${words[2]}
  prev=\${words[CURRENT-1]}
  case \${cmd}:\${prev} in
${valueBranches}
  esac
  if [[ \${words[CURRENT]} == -* ]]; then
    case \${cmd} in
${flagBranches}
    esac
    compadd -- \${flags}
    return
  fi
  _files
}
compdef ${fn} ${binName}
`;
}
