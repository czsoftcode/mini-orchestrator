import { describe, expect, it } from 'vitest';
import { buildAuditCodebasePrompt, CODEBASE_FILE } from './auditCodebase.js';

const PROJECT_MD = `# Můj projekt
Stavím nástroj X pro Y.`;

describe('buildAuditCodebasePrompt', () => {
  it('renders project section and references codebase file path', () => {
    const out = buildAuditCodebasePrompt(PROJECT_MD);

    expect(out).toContain('# Projekt');
    expect(out).toContain(PROJECT_MD);
    expect(out).toContain(CODEBASE_FILE);
    expect(out).toContain('NEIMPLEMENTUJ');
    expect(out).toMatchSnapshot();
  });

  it('instructs incremental update — read first, prefer Edit, keep manual notes', () => {
    const out = buildAuditCodebasePrompt(PROJECT_MD);

    expect(out).toContain('první akce');
    expect(out).toContain('NEPŘEPISUJ celý soubor');
    expect(out).toContain('Ruční poznámky');
    expect(out).toMatch(/Edit/);
  });

  it('lists fixed section names for new codebase.md', () => {
    const out = buildAuditCodebasePrompt(PROJECT_MD);

    expect(out).toContain('## Přehled');
    expect(out).toContain('## Adresářová struktura');
    expect(out).toContain('## Klíčové moduly');
    expect(out).toContain('## Technologie');
  });

  it('trims projectMd whitespace', () => {
    const out = buildAuditCodebasePrompt(`\n\n  ${PROJECT_MD}  \n\n`);

    expect(out).toContain(`# Projekt\n${PROJECT_MD}\n`);
    expect(out).not.toContain('# Projekt\n\n');
  });
});
