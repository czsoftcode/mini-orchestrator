import { askClaude } from '../claude/ask.js';
import { buildAuditCodebasePrompt, CODEBASE_FILE } from '../prompts/auditCodebase.js';
import { isBrownfield } from '../state/brownfield.js';
import { resolveModel } from '../state/models.js';
import { exists, readProject, load } from '../state/store.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';
import type { StepOutcome } from './types.js';

const AUDIT_ALLOWED_TOOLS = ['Read', 'Grep', 'Glob', 'LS', 'Write', 'Edit'];
const AUDIT_TIMEOUT_MS = 10 * 60 * 1000;

export async function audit(): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('There is no project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  if (!(await isBrownfield(cwd))) {
    log.warn('Nothing to audit — the directory is empty.');
    log.hint('An audit makes sense only once some code exists in the project.');
    return { ok: false, reason: 'greenfield' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);
  const prompt = buildAuditCodebasePrompt(projectMd);

  log.dim(`Going through the code and updating ${CODEBASE_FILE}…`);

  let response;
  try {
    response = await askClaude(prompt, {
      cwd,
      allowedTools: AUDIT_ALLOWED_TOOLS,
      permissionMode: 'acceptEdits',
      timeoutMs: AUDIT_TIMEOUT_MS,
      model: resolveModel('audit', state),
    });
  } catch (err) {
    log.error(`Failed to ask Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  logUsage(response);
  log.success(`${CODEBASE_FILE} updated.`);
  log.hint('You can add your own notes to the file — the next audit will keep them.');
  return { ok: true };
}
