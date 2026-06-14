import { describe, expect, it } from 'vitest';
import { renderLinkedFindingBlock } from './linkedFinding.js';

describe('renderLinkedFindingBlock', () => {
  it('renders the full detail (id, severity, where, title, body)', () => {
    const block = renderLinkedFindingBlock({
      id: '155-1',
      severity: 'blocker',
      where: 'src/foo.ts:42',
      title: 'unchecked null',
      body: 'When input is empty the parser returns undefined and the caller crashes.',
    });
    expect(block).toContain('# Linked adversarial finding');
    expect(block).toContain('--from-finding 155-1');
    expect(block).toContain('**155-1 · blocker · src/foo.ts:42** — unchecked null');
    expect(block).toContain('the caller crashes');
  });

  it('omits the where suffix and the body when absent', () => {
    const block = renderLinkedFindingBlock({ id: '156-2', severity: 'nit', title: 'rename helper' });
    expect(block).toContain('**156-2 · nit** — rename helper');
    expect(block).not.toContain(' · undefined');
  });

  it('renders a soft note when the finding could not be found', () => {
    const block = renderLinkedFindingBlock({ id: '155-9', missing: true });
    expect(block).toContain('# Linked adversarial finding');
    expect(block).toContain('`155-9`');
    expect(block).toContain('could not be found');
    // It must NOT pretend to show a finding body.
    expect(block).not.toContain('Treat it as the primary source');
  });
});
