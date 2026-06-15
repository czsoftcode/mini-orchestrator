import { describe, expect, it } from 'vitest';
import { COMMAND_DEFS, renderCommandMd } from './commands.js';
import { ASK_AND_STOP_HINT, VERBATIM_OUTPUT_HINT } from '../prompts/sessionHints.js';

function bodyOf(name: string): string {
  const def = COMMAND_DEFS.find((d) => d.name === name);
  if (!def) throw new Error(`Unknown command def: ${name}`);
  return renderCommandMd(def);
}

describe('hardened command bodies (Fable 5 prompt hardening)', () => {
  // Commands whose whole job is showing a command's output to the user.
  const VERBATIM_COMMANDS = ['init', 'status', 'doctor', 'changelog', 'map', 'model', 'import-gsd', 'undo', 'upgrade', 'todo'];

  it.each(VERBATIM_COMMANDS)('%s prints the command output verbatim', (name) => {
    expect(bodyOf(name)).toContain(VERBATIM_OUTPUT_HINT);
  });

  // Commands with a question/confirmation step that must end the turn.
  const ASK_COMMANDS = ['init', 'undo', 'upgrade', 'model', 'import-gsd'];

  it.each(ASK_COMMANDS)('%s ends the turn when asking the user', (name) => {
    expect(bodyOf(name)).toContain(ASK_AND_STOP_HINT);
  });

  it('renders the hints as text, not as unexpanded placeholders', () => {
    for (const def of COMMAND_DEFS) {
      const md = renderCommandMd(def);
      expect(md).not.toContain('${');
      expect(md).not.toContain('_HINT');
    }
  });
});

describe('adversarial slash command', () => {
  it('is registered in COMMAND_DEFS', () => {
    expect(COMMAND_DEFS.some((d) => d.name === 'adversarial')).toBe(true);
  });

  it('runs mini context adversarial and warns the inline review shares context', () => {
    const md = bodyOf('adversarial');
    expect(md).toContain('mini context adversarial');
    // The independence caveat must be explicit, with both escape hatches.
    expect(md).toContain('inline in this very session');
    expect(md).toContain('mini adversarial');
    expect(md).toContain('/clear');
    // It writes findings, it does not move state.
    expect(md).toContain('does **not** move the phase state');
  });
});

describe('adversarial-project slash command', () => {
  it('is registered in COMMAND_DEFS', () => {
    expect(COMMAND_DEFS.some((d) => d.name === 'adversarial-project')).toBe(true);
  });

  it('reminds the human that security is a separate `mini security` pass', () => {
    const md = bodyOf('adversarial-project');
    expect(md).toContain('not** a security audit');
    expect(md).toContain('mini security');
    expect(md).toContain('separate terminal');
    expect(md).toContain('done and committed');
  });
});

describe('security slash command', () => {
  it('is registered in COMMAND_DEFS with a range argument hint', () => {
    const def = COMMAND_DEFS.find((d) => d.name === 'security');
    expect(def).toBeDefined();
    expect(def?.argumentHint).toContain('--from-phase');
  });

  it('runs mini context security, passes $ARGUMENTS, and warns the inline review is unscoped', () => {
    const md = bodyOf('security');
    expect(md).toContain('mini context security $ARGUMENTS');
    // The independence caveat must be explicit, with both escape hatches.
    expect(md).toContain('inline in this very session');
    expect(md).toContain('mini security');
    expect(md).toContain('/clear');
    // The inline path does not enforce the scoped tool set — say so.
    expect(md).toContain('does **not** apply inline');
    // No-flags default = last completed phase.
    expect(md).toContain('last completed');
    // Security is a separate output, not the findings store.
    expect(md).toContain('does **not** file into');
  });
});
