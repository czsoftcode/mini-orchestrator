import { describe, expect, it } from 'vitest';
import { SECURITY_ALLOWED_TOOLS } from './security.js';

// A pinning test, independent of the command's control-flow test: it locks the
// exact scoped tool set so any drift (a tool added, removed or rescoped) fails
// here on its own. The security review is report-only and writes its own report,
// so the contract is: read + search, read-only git, a single scoped Write — and
// emphatically no Edit and no findings-store write.
describe('SECURITY_ALLOWED_TOOLS', () => {
  it('pins the exact report-only tool set', () => {
    expect(SECURITY_ALLOWED_TOOLS).toEqual([
      'Read',
      'Grep',
      'Glob',
      'LS',
      'Bash(git diff:*)',
      'Bash(git log:*)',
      'Bash(git show:*)',
      'Write(.mini/security/**)',
    ]);
  });

  it('scopes Write to the security report directory only', () => {
    expect(SECURITY_ALLOWED_TOOLS).toContain('Write(.mini/security/**)');
    // A bare, unscoped Write would let the reviewer touch any file.
    expect(SECURITY_ALLOWED_TOOLS).not.toContain('Write');
  });

  it('cannot edit source code or file into the findings store', () => {
    expect(SECURITY_ALLOWED_TOOLS).not.toContain('Edit');
    expect(SECURITY_ALLOWED_TOOLS).not.toContain('Bash(mini findings add:*)');
  });
});
