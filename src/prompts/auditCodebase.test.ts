import { describe, expect, it } from 'vitest';
import { buildAuditCodebasePrompt, CODEBASE_FILE } from './auditCodebase.js';

const PROJECT_MD = `# Můj projekt
Stavím nástroj X pro Y.`;

describe('buildAuditCodebasePrompt', () => {
  it('renders project section and references codebase file path', () => {
    const out = buildAuditCodebasePrompt(PROJECT_MD);

    expect(out).toContain('# Project');
    expect(out).toContain(PROJECT_MD);
    expect(out).toContain(CODEBASE_FILE);
    expect(out).toContain('DO NOT implement');
    expect(out).toMatchSnapshot();
  });

  it('instructs incremental update — read first, prefer Edit, keep manual notes', () => {
    const out = buildAuditCodebasePrompt(PROJECT_MD);

    expect(out).toContain('first action');
    expect(out).toContain('DO NOT REWRITE the whole file');
    expect(out).toContain('manual notes');
    expect(out).toMatch(/Edit/);
  });

  it('lists fixed section names for new codebase.md', () => {
    const out = buildAuditCodebasePrompt(PROJECT_MD);

    expect(out).toContain('## Overview');
    expect(out).toContain('## Directory structure');
    expect(out).toContain('## Key modules');
    expect(out).toContain('## Technologies');
  });

  it('trims projectMd whitespace', () => {
    const out = buildAuditCodebasePrompt(`\n\n  ${PROJECT_MD}  \n\n`);

    expect(out).toContain(`# Project\n${PROJECT_MD}\n`);
    expect(out).not.toContain('# Project\n\n');
  });
});
