/**
 * Shared renderer for `.mini/project.md`.
 *
 * Single source of truth for the layout of `project.md`, used by `mini init`,
 * `mini import-gsd` and (later) `mini project`. It is **pure layout**: it never
 * substitutes defaults for empty values — each caller resolves its own
 * fallbacks before calling (init and import-gsd differ on the `forWhom`
 * placeholder, so a single internal fallback would change one of their
 * outputs). With the optional fields omitted the output is byte-for-byte
 * identical to the previous per-command renderers.
 *
 * The headings `# <name>` and `## What I'm building` must not be renamed or
 * reordered — `src/commands/status.ts` parses them by regex.
 */
export interface ProjectMdFields {
  /** Project name (the `# <name>` heading). */
  name: string;
  /** What is being built. */
  what: string;
  /** Who it is for (pass the resolved placeholder when empty). */
  forWhom: string;
  /** Main constraints (pass the resolved placeholder when empty). */
  constraints: string;
  /** Optional: how to approach the project — rendered only when non-empty. */
  approach?: string;
  /** Optional: where deliberately not to go — rendered only when non-empty. */
  nonGoals?: string;
  /** Optional: success criteria — rendered only when non-empty. */
  success?: string;
}

/**
 * Renders `project.md` from the given fields. Section order:
 * name → What I'm building → Who it's for → [Approach] → [Non-goals] →
 * [Success criteria] → Main constraints. Optional sections are emitted only
 * when their value is non-empty; Main constraints always stays last.
 */
export function renderProjectMd(f: ProjectMdFields): string {
  const sections: string[] = [
    `# ${f.name}`,
    `## What I'm building\n${f.what}`,
    `## Who it's for\n${f.forWhom}`,
  ];

  if (f.approach) sections.push(`## Approach\n${f.approach}`);
  if (f.nonGoals) sections.push(`## Non-goals\n${f.nonGoals}`);
  if (f.success) sections.push(`## Success criteria\n${f.success}`);

  sections.push(`## Main constraints\n${f.constraints}`);

  return `${sections.join('\n\n')}\n`;
}
