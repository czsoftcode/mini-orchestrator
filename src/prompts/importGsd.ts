export function buildImportGsdPrompt(): string {
  return `This directory contains a work-in-progress GSD project in .planning/. Your task is to extract a skeleton from it for a new (simpler) tool.

Find these things (you may read files via Read/Glob/Grep, do not write anything):
1. A short project description — what is being built, for whom, main constraints
2. A list of phases from the roadmap or the directory structure, with their status

Typical GSD files: .planning/PROJECT.md, .planning/ROADMAP.md, .planning/milestones/, .planning/phases/.

Reply ONLY in this format, write nothing else. Each value must be on ONE line:

NAME: <project name>
WHAT: <2-3 sentences about what is being built — on one line>
FOR_WHOM: <for whom, or "-">
CONSTRAINTS: <language/framework/constraints, or "-">

PHASES:
1 | done | Initial setup
2 | done | Authentication
3 | doing | Profile page
4 | todo | Notifications

Rules for PHASES:
- Status must be EXACTLY one of: done, doing, todo, skipped
- Order by the roadmap, ID 1, 2, 3, … (renumber sequentially, ignore decimal numbers like 1.1)
- Finished phases (completed, archived, finished) → done
- In-progress ones (in_progress, active) → doing
- Future ones (pending, planned, proposed) → todo
- Cancelled ones (cancelled, canceled) → skipped
- If you cannot find a roadmap, try to derive the phases from the directory structure (each subfolder = a phase)
`;
}
