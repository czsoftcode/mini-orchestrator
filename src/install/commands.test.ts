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
