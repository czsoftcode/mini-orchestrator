import { describe, expect, it } from 'vitest';
import { isShell, renderCompletion, SHELLS } from './render.js';

const SPEC = { binName: 'mini', commands: ['init', 'next', 'do', 'done'] };

describe('isShell', () => {
  it('accepts the supported shells', () => {
    for (const shell of SHELLS) {
      expect(isShell(shell)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isShell('fish')).toBe(false);
    expect(isShell('')).toBe(false);
  });
});

describe('renderCompletion bash', () => {
  const script = renderCompletion('bash', SPEC);

  it('registers a completion function for the binary', () => {
    expect(script).toContain('complete -F _mini_completion mini');
  });

  it('completes the command names on the first word', () => {
    expect(script).toContain('local commands="init next do done"');
  });

  it('falls back to file completion for further arguments', () => {
    expect(script).toContain('compgen -f');
  });

  it('matches the snapshot', () => {
    expect(script).toMatchInlineSnapshot(`
      "# bash completion for mini
      # Enable with: source <(mini completion bash)
      _mini_completion() {
        local cur cword
        cur="\${COMP_WORDS[COMP_CWORD]}"
        cword=\${COMP_CWORD}
        local commands="init next do done"
        if [ "\${cword}" -eq 1 ]; then
          COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
          return 0
        fi
        COMPREPLY=( $(compgen -f -- "\${cur}") )
        return 0
      }
      complete -F _mini_completion mini
      "
    `);
  });
});

describe('renderCompletion zsh', () => {
  const script = renderCompletion('zsh', SPEC);

  it('starts with the #compdef directive', () => {
    expect(script.startsWith('#compdef mini')).toBe(true);
  });

  it('registers the function with compdef', () => {
    expect(script).toContain('compdef _mini mini');
  });

  it('lists the command names', () => {
    expect(script).toContain('commands=(init next do done)');
  });

  it('matches the snapshot', () => {
    expect(script).toMatchInlineSnapshot(`
      "#compdef mini
      # zsh completion for mini
      # Enable with: source <(mini completion zsh)
      _mini() {
        local -a commands
        commands=(init next do done)
        if (( CURRENT == 2 )); then
          compadd -- \${commands}
          return
        fi
        _files
      }
      compdef _mini mini
      "
    `);
  });
});
