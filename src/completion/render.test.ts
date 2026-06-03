import { describe, expect, it } from 'vitest';
import { isShell, renderCompletion, SHELLS } from './render.js';

const SPEC = {
  binName: 'mini',
  commands: [
    { name: 'init', flags: [{ name: '--apply' }, { name: '--name' }] },
    { name: 'next', flags: [] },
    {
      name: 'done',
      flags: [{ name: '--apply' }, { name: '--bump', values: ['none', 'patch', 'minor', 'major'] }],
    },
  ],
};

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
    expect(script).toContain('local commands="init next done"');
  });

  it('completes a command’s flags when the word starts with a dash', () => {
    expect(script).toContain('done) flags="--apply --bump" ;;');
  });

  it('completes a flag’s enumerated values when it is the previous word', () => {
    expect(script).toContain(
      'done:--bump) COMPREPLY=( $(compgen -W "none patch minor major" -- "${cur}") ); return 0 ;;',
    );
  });

  it('omits a value branch for flags without values', () => {
    expect(script).not.toContain('done:--apply)');
  });

  it('matches the snapshot', () => {
    expect(script).toMatchInlineSnapshot(`
      "# bash completion for mini
      # Enable with: source <(mini completion bash)
      _mini_completion() {
        local cur prev cword cmd flags
        cur="\${COMP_WORDS[COMP_CWORD]}"
        prev="\${COMP_WORDS[COMP_CWORD-1]}"
        cword=\${COMP_CWORD}
        local commands="init next done"
        if [ "\${cword}" -eq 1 ]; then
          COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
          return 0
        fi
        cmd="\${COMP_WORDS[1]}"
        case "\${cmd}:\${prev}" in
            done:--bump) COMPREPLY=( $(compgen -W "none patch minor major" -- "\${cur}") ); return 0 ;;
        esac
        if [[ "\${cur}" == -* ]]; then
          flags=""
          case "\${cmd}" in
            init) flags="--apply --name" ;;
            done) flags="--apply --bump" ;;
          esac
          COMPREPLY=( $(compgen -W "\${flags}" -- "\${cur}") )
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

  it('completes a flag’s enumerated values', () => {
    expect(script).toContain('done:--bump) compadd -- none patch minor major; return ;;');
  });

  it('matches the snapshot', () => {
    expect(script).toMatchInlineSnapshot(`
      "#compdef mini
      # zsh completion for mini
      # Enable with: source <(mini completion zsh)
      _mini() {
        local -a commands flags
        local cmd prev
        commands=(init next done)
        if (( CURRENT == 2 )); then
          compadd -- \${commands}
          return
        fi
        cmd=\${words[2]}
        prev=\${words[CURRENT-1]}
        case \${cmd}:\${prev} in
            done:--bump) compadd -- none patch minor major; return ;;
        esac
        if [[ \${words[CURRENT]} == -* ]]; then
          case \${cmd} in
            init) flags=(--apply --name) ;;
            done) flags=(--apply --bump) ;;
          esac
          compadd -- \${flags}
          return
        fi
        _files
      }
      compdef _mini mini
      "
    `);
  });
});
