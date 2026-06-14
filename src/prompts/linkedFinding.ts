/**
 * Shared renderer for the adversarial finding a phase was created to fix
 * (`mini next --apply --from-finding <id>`). Used by both the `discuss` and the
 * `plan` session prompts so the reviewer/planner sees the finding's full detail
 * — the actionable "what breaks and how" body that the `next` headline list does
 * not carry — read straight from the durable link on the phase, not from chat
 * memory left behind by `next`.
 *
 * Two shapes, decided by the caller (`context.ts`): the resolved finding detail,
 * or a soft note when the link points at a finding that can no longer be found
 * (resolved, or its file removed). The soft note degrades gracefully instead of
 * crashing or printing a misleading "no phase" message.
 *
 * Returns the **whole block** including its `# Linked adversarial finding`
 * heading, so the caller just drops it into the prompt where it fits.
 */

/** Full detail of a linked finding (the store's `Finding`, narrowed to what the prompt shows). */
export interface LinkedFindingDetail {
  id: string;
  severity: string;
  /** Optional location (`file:line`). */
  where?: string;
  title: string;
  /** Optional longer body — what breaks and how. */
  body?: string;
}

/** Input to {@link renderLinkedFindingBlock}: the detail, or a "could not be found" marker. */
export type LinkedFindingInput = LinkedFindingDetail | { id: string; missing: true };

export function renderLinkedFindingBlock(input: LinkedFindingInput): string {
  if ('missing' in input) {
    return (
      '# Linked adversarial finding\n' +
      `This phase was created to fix adversarial finding \`${input.id}\` ` +
      '(`--from-finding`), but it could not be found — it may have been resolved ' +
      'or its file removed. Work from the phase goal and notes instead.\n'
    );
  }
  const where = input.where?.trim() ? ` · ${input.where.trim()}` : '';
  const body = input.body?.trim() ? `\n\n${input.body.trim()}` : '';
  return (
    '# Linked adversarial finding\n' +
    `This phase was created to fix the adversarial finding below ` +
    `(\`--from-finding ${input.id}\`). Treat it as the primary source for what ` +
    'needs fixing:\n\n' +
    `**${input.id} · ${input.severity}${where}** — ${input.title}${body}\n`
  );
}
