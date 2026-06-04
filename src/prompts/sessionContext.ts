import { phaseStem } from '../state/store.js';
import type { Phase, PhaseStatus, ProjectState, Step, StepStatus } from '../state/types.js';
import { GRAPH_USAGE_HINT } from './graphHint.js';

/**
 * Session prompty pro nativní `/mini:` slash commandy v Claude Code.
 *
 * Na rozdíl od headless promptů (`nextPhase`, `planPhase`, …), které Claude
 * dostane jako jednorázovou zprávu a odpoví strojově čitelným formátem, jsou
 * tyhle určené do **běžící Claude session**. Claude tu nemá odpovídat fixním
 * formátem — má odvést agentní práci a **stav uložit zavoláním neinteraktivního
 * `mini ... --apply` přes Bash**. Stav tak zůstává v otestovaném TS, ne v promptu.
 *
 * Builders tu žijí pohromadě s ostatními prompty, aby `mini context <cmd>`
 * (který je vypisuje na stdout) vždy sahal po jediném, aktuálním zdroji pravdy.
 */

const STEP_WORD: Record<StepStatus, string> = {
  done: 'done',
  doing: 'in progress',
  todo: 'todo',
  skipped: 'skipped',
};

const PHASE_WORD: Record<PhaseStatus, string> = {
  done: 'done',
  doing: 'in progress',
  planned: 'planned',
  proposed: 'proposed',
  skipped: 'skipped',
};

/** An open backlog item with its 1-based position in `.mini/todo.md`. */
export interface OpenTodo {
  /** 1-based archive position (counted over all items) — the `<n>` for `--from-todo`. */
  index: number;
  text: string;
}

export interface NextSessionOptions {
  userHint?: string;
  /** Obsah `.mini/last-memory.md`, pokud existuje. */
  lastMemoryMd?: string;
  /** Open items from the `.mini/todo.md` archive, offered as candidate ideas. */
  openTodos?: OpenTodo[];
}

/**
 * Prompt pro `/mini:next` — Claude navrhne další fázi a uloží ji přes
 * `mini next --apply`. Vstupní bod cyklu: aktuální fáze ještě nemusí existovat.
 */
export function buildNextSessionPrompt(
  projectMd: string,
  state: ProjectState,
  options: NextSessionOptions = {},
): string {
  const historyLines = state.phases.map(
    (p) => `- [${PHASE_WORD[p.status]}] ${p.id}. ${p.title}`,
  );
  const history =
    historyLines.length > 0
      ? `# Progress so far\n${historyLines.join('\n')}\n`
      : '# Progress\nThe project is brand new, there are no phases yet.\n';

  const memory = options.lastMemoryMd?.trim();
  const memoryBlock = memory
    ? `# Last phase\nSummary of the last finished phase (what was done, what to watch out for):\n"""\n${memory}\n"""\n\n`
    : '';

  const hint = options.userHint?.trim();
  const hintBlock = hint
    ? `# User's idea\nThe user has an idea they want to develop in the next phase:\n"""\n${hint}\n"""\nStart from exactly this. If the idea is too big for one phase (1-3 days), pick the first meaningful piece of it.\n\n`
    : '';

  // Bez nápadu se nejdřív zeptej — uživatel ho mohl zapomenout zadat.
  const askBlock = hint
    ? ''
    : `# Ask first\nThe user gave you nothing for the next phase. Before you propose anything, **ask them** whether they have their own idea for the next phase (they may have forgotten to provide it), or whether to leave it up to you. Only then continue based on the answer:\n- if they have their own idea → start from exactly that,\n- if they leave it to you → sketch **2-3** candidate ideas based on the progress so far and the state of the code; propose the most sensible one as the phase, and **offer to stash the rest** into the project's ideas archive with \`mini todo add "<text>"\` (one call per idea, only after the user approves) so they aren't lost.\n\n`;

  // Open items from `.mini/todo.md` — candidate ideas the user collected earlier.
  // Each keeps its 1-based archive position so a phase born from one can be saved
  // with `mini next --apply --from-todo <n>`, which ticks the item off in one go.
  const openTodos = (options.openTodos ?? [])
    .map((t) => ({ index: t.index, text: t.text.trim() }))
    .filter((t) => t.text);
  const todoBlock =
    openTodos.length > 0
      ? `# Ideas in the backlog\nThe project keeps an ideas/changes archive (\`mini todo\`). Open items (numbered by their archive position), any of which could become the next phase:\n${openTodos
          .map((t) => `- [${t.index}] ${t.text}`)
          .join(
            '\n',
          )}\nIf one of them fits as the next step, propose it. When you save such a phase, add \`--from-todo <n>\` (the bracketed number) to \`mini next --apply\` so the source item is ticked off automatically.\n\n`
      : '';

  return `You are in a Claude Code session helping the user build a project in small phases.
This is the **next** step of the mini workflow — propose ONE next phase.

# Project
${projectMd.trim()}

${history}
${memoryBlock}${todoBlock}${askBlock}${hintBlock}# Your task
Propose one next phase. It should be small (1-3 days of work), with a clear, verifiable goal — not a roadmap, just one thing that makes sense to do right now. ${GRAPH_USAGE_HINT}

Show the proposal (name, max 5 words + goal in 1 sentence) briefly to the user. After they approve, **save** the phase by calling (Bash):

\`\`\`
mini next --apply --title "<name>" --goal "<phase goal>"
\`\`\`

If the phase comes from a backlog item above, append \`--from-todo <n>\` (its bracketed number) so that item is ticked off in the archive automatically.

Change the phase state only with this command — never edit \`.mini/state.json\` by hand.

If you consider the project finished, save nothing and tell the user.

After saving, write that the next step is \`/mini:discuss\` (discuss) or \`/mini:plan\` (break it down right away).
`;
}

/**
 * Prompt pro `/mini:plan` — Claude rozmení aktuální fázi na kroky a uloží je
 * přes `mini plan --apply` (kroky předá na stdin, jeden na řádek).
 */
export function buildPlanSessionPrompt(
  projectMd: string,
  phase: Phase,
  discussNotes?: string | null,
): string {
  const notes = discussNotes?.trim();
  const notesBlock = notes ? `\n# Phase notes (from discussion)\n${notes}\n` : '';

  let stepsBlock = '';
  if (phase.steps?.length) {
    const lines = (phase.steps as Step[]).map((s) => `- [${STEP_WORD[s.status]}] ${s.title}`);
    stepsBlock = `\nThe phase already has steps (saving will overwrite them):\n${lines.join('\n')}\n`;
  }

  return `You are in a Claude Code session helping the user build a project in small phases.
This is the **plan** step of the mini workflow — break the current phase down into concrete steps.

# Project
${projectMd.trim()}

# Phase to break down
**Phase ${phase.id}: ${phase.title}**
Goal: ${phase.goal ?? '(not set)'}
${stepsBlock}${notesBlock}
# Your task
Break the phase down into 3-7 concrete steps. Each step has two parts:

- **title** — a short, descriptive name (ideally up to 8 words). It serves as the step's canonical identifier (it's paired with the report), so keep it concise and stable.
- **detail** (optional) — a longer clarification: verifiable output and criteria (e.g. "API endpoint /tasks returns JSON; covered by a test"). This is where things that would otherwise bloat the title belong.

Each step must have a clear, verifiable output (e.g. "API endpoint /tasks returns JSON" — not "build the backend"); if it doesn't fit in the title, put it in the detail. ${GRAPH_USAGE_HINT}

Show the steps briefly to the user. After they approve, **save** them by calling (Bash) — one step per line in the format \`title :: detail\` (the \` :: \` separator is optional; a line without it is just a title):

\`\`\`
printf '%s\\n' \\
  "<title of the first step> :: <detail of the first step>" \\
  "<title of the second step without detail>" \\
  "<title of the third step> :: <detail of the third step>" | mini plan --apply
\`\`\`

Change the phase state only with this command — never edit \`.mini/state.json\` by hand.

After saving, write that the next step is \`/mini:do\` (implement the phase).
`;
}

export interface DoneSessionInput {
  phase: Phase;
  /** Existuje report `.mini/run/phase-{id}.md`? */
  reportExists: boolean;
  /** Volný text reportu (poznámky pro člověka), pokud je. */
  reportBody?: string;
  /** Body k ručnímu ověření z reportu — Claude je probere s uživatelem. */
  verify: { title: string; detail?: string }[];
}

/**
 * Prompt pro `/mini:done` — lidská verifikace proběhne přirozeně dotazem v
 * chatu, posun stavu pak udělá `mini done --apply`.
 */
export function buildDoneSessionPrompt(input: DoneSessionInput): string {
  const { phase, reportExists, reportBody, verify } = input;

  if (!reportExists) {
    return `You are in a Claude Code session — the **done** step of the mini workflow.

Phase **${phase.id}: ${phase.title}** does not have an implementation report yet (\`.mini/run/${phaseStem(phase.id)}.md\` is missing).
Without a report the state can't be moved non-interactively. First run \`/mini:do\` (implement the phase and write the report), then come back to \`/mini:done\`.
`;
  }

  const bodyBlock = reportBody?.trim()
    ? `\n# Implementation report\n${reportBody.trim()}\n`
    : '';

  let verifyBlock: string;
  let applyHint: string;
  if (verify.length > 0) {
    const lines = verify.map((v, i) => {
      const detail = v.detail ? `\n     ${v.detail}` : '';
      return `  ${i + 1}. ${v.title}${detail}`;
    });
    verifyBlock = `\n# Items for manual verification\nClaude did not verify these itself — go through them with the user:\n${lines.join('\n')}\n`;
    applyHint = `Once the user approves the verification, move the state (Bash):

\`\`\`
mini done --apply --accept-verify
\`\`\`

If the user finds a problem, don't close the phase — go back to \`/mini:do\` and fix it.`;
  } else {
    verifyBlock = '\n# Items for manual verification\nClaude listed none — it verified everything itself.\n';
    applyHint = `Ask the user whether the phase works. After confirmation, move the state (Bash):

\`\`\`
mini done --apply
\`\`\``;
  }

  return `You are in a Claude Code session — the **done** step of the mini workflow.
Phase **${phase.id}: ${phase.title}** is finished from an implementation standpoint.

# Your task
Human verification: briefly summarize for the user what was done (see the report below) and let them confirm that it works.
${bodyBlock}${verifyBlock}
# CHANGELOG
Still **before** \`mini done --apply\`, record what the phase delivered into \`CHANGELOG.md\`
(keepachangelog 1.1.0 format) — the phase commit then picks it up automatically:
- The file is in the project root; if it's missing, create it with a short header and an \`## [Unreleased]\` section.
- From the report, pick the changes interesting to the user and add them under \`## [Unreleased]\` into the subsections
  \`### Added\` (new feature), \`### Changed\` (behavior change) or \`### Fixed\` (a fix) — only those that make sense.
- **Do not fill in a version or date** — stay at \`## [Unreleased]\`. The dated section \`## [version] - date\`
  is produced only by \`mini done --apply --push\` on a minor/major release; patches accumulate in Unreleased.
- Purely internal changes with no user impact can be omitted.

# Decision record (ADR) — only on a real crossroads
The **default is to write nothing.** Most phases carry no ADR. Write one **only**
when this phase made a non-trivial decision: a concrete alternative was weighed
and **rejected**, and the choice would not be obvious from the code half a year
later (an architectural/contract call, a deliberate trade-off). Routine choices
(naming, a loop style, an obvious library) get **no** ADR — do not invent a
decision just to fill the file.

This is **not** the CHANGELOG: the CHANGELOG says *what* changed for users, the
ADR says *why* this path was chosen over another. Don't duplicate the text.

When there genuinely was such a decision:
1. Draft a lean ADR and **show it to the user** in the chat for edits/approval —
   never write it silently. Structure:
   \`\`\`
   # <short decision title>

   ## Decision
   <what was decided, 1-3 sentences>

   ## Why
   <the rejected alternative and the reason this path won>
   \`\`\`
2. After the user approves, write it **before** \`mini done --apply\` (Bash), so it
   lands in the phase commit:
   \`\`\`
   printf '%s\\n' \\
     "# <short decision title>" \\
     "" \\
     "## Decision" \\
     "<what was decided>" \\
     "" \\
     "## Why" \\
     "<rejected alternative + reason>" | mini decision --apply
   \`\`\`
   It targets the current phase, so it must run before the state moves. An empty
   body or a body without a \`# \` heading writes nothing (then just continue).

# Moving the state
${applyHint}

Change the phase state only with the \`mini done --apply\` command — never edit \`.mini/state.json\` by hand. \`mini done --apply\` reads the report, moves the steps, closes the phase and commits the work. By default it does **not** bump the version in package.json (\`--bump none\`) — suitable for partial phases, where the version is bumped only at the end of a whole unit.

Version and push:
- Bump the version only on request (agreed with the user): add \`--bump patch\`, \`--bump minor\` or \`--bump major\`. Without \`--bump\` (default \`none\`) the version stays unchanged.
- Pushing to the remote is opt-in: when the user wants it, add \`--push\` (otherwise the work stays only in a local commit). \`--push\` is a release, so it **requires an explicit** \`--bump patch|minor|major\` — with \`none\` (or without \`--bump\`) it fails with an error.

After closing, write that the next step is \`/mini:next\` (propose the next phase), and **offer the user the \`/clear\` command** to clear the Claude Code context before the next phase (the user must type \`/clear\` themselves).
`;
}

export interface VerifySessionInput {
  phase: Phase;
  /**
   * Je fáze už uzavřená (status `done`)? Mění úvodní rámec promptu: u uzavřené
   * fáze jde o zpětnou hloubkovou kontrolu, u rozdělané o kontrolu před `done`.
   */
  phaseDone: boolean;
  /** Body k ručnímu ověření z run reportu — kostra hloubkové kontroly. */
  verify: { title: string; detail?: string }[];
  /** Volný text reportu (poznámky pro člověka), pokud existuje. */
  reportBody?: string;
  /** Existuje run report `.mini/run/phase-{id}.md`? Řídí, kam zapsat nálezy. */
  reportExists: boolean;
}

/**
 * Prompt pro `/mini:verify` — interaktivní hloubková UI/UX kontrola fáze
 * člověkem. Na rozdíl od `done` (kde verifikace proběhne mimochodem) tady Claude
 * člověka **aktivně vede** kontrolou: projde verify body z reportu, doplní širší
 * UX procházku a posbírá nálezy. Nálezy zapíše do run reportu (a tím i do paměti,
 * kterou `mini done` z reportu skládá); stav fáze ale **neposouvá** — to je `done`.
 */
export function buildVerifySessionPrompt(input: VerifySessionInput): string {
  const { phase, phaseDone, verify, reportBody, reportExists } = input;
  const reportRel = `.mini/run/${phaseStem(phase.id)}.md`;
  const memoryRel = `.mini/memory/${phaseStem(phase.id)}.md`;

  const frame = phaseDone
    ? `**Phase ${phase.id}: ${phase.title}** is already closed — this is a **retrospective in-depth review** of its UI/UX by a human.`
    : `**Phase ${phase.id}: ${phase.title}** is implemented but not yet closed — go through its UI/UX with a human **before you close it in \`done\`**.`;

  const bodyBlock = reportBody?.trim()
    ? `\n# Implementation report\n${reportBody.trim()}\n`
    : '';

  let verifyBlock: string;
  if (verify.length > 0) {
    const lines = verify.map((v, i) => {
      const detail = v.detail ? `\n     ${v.detail}` : '';
      return `  ${i + 1}. ${v.title}${detail}`;
    });
    verifyBlock = `\n# Items from the report to verify\nClaude did not verify these itself — use them as the skeleton of the review:\n${lines.join('\n')}\n`;
  } else {
    verifyBlock = `\n# Items from the report to verify\nThe report lists no explicit verify items — guide the review by the phase goal and the steps below.\n`;
  }

  const stepsBlock =
    phase.steps && phase.steps.length > 0
      ? `\n# Phase steps\n${phase.steps
          .map((s: Step) => `  - ${s.title}${s.detail ? `\n    ${s.detail}` : ''}`)
          .join('\n')}\n`
      : '';

  // Kam zapsat nálezy. Hlavní cíl je run report — `mini done` z něj skládá
  // paměť, takže přes report se nálezy dostanou i tam. U rozdělané fáze stačí
  // report. U už uzavřené fáze je paměť hotová, proto nálezy přidej i do ní.
  const reportWrite = reportExists
    ? `via \`Read\` + \`Edit\` add a \`## Verify findings\` section at the end of \`${reportRel}\` (date + bullets: what is OK, what should be fixed and how). This section is **below** the report's YAML header, so it won't disturb the parser or \`mini done\``
    : `the report \`${reportRel}\` does not exist yet — create it via \`Write\` with at least a \`## Verify findings\` section (date + bullets), so the findings don't stay only in the chat`;
  const memoryWrite = phaseDone
    ? `\n   The phase is **already closed**, so the memory \`${memoryRel}\` is finished and \`mini done\` won't pull the report into it retroactively — add the same findings to the end of the memory file too (a \`## Verify findings\` section). Note: the file may have a numeric suffix (\`-2\` etc.) when the phase went through \`done\` multiple times — edit the most recent one.`
    : '';

  return `You are in a Claude Code session — the **verify** step of the mini workflow.
${frame}

# Your task
Take the human through an **in-depth UI/UX review** of this phase. You're not here for machine tests (those belong in \`do\`), but for things only a human can judge: visual appearance, clarity, the smoothness of the UX flow, small details and the overall impression. Proceed interactively — **ask one at a time**, let the human react, and only then continue:

1. **Set the scene.** From the phase goal, the steps and the report below, determine what specifically should be reviewed and how the human will see it (which command/screen/output to run). When something needs to be started up (build, dev server, sample input), propose the exact steps.
2. **Go through the verify items.** Take the items from the report as a skeleton and for each let the human confirm that it looks and behaves correctly. Actively ask about details, not just "does it work?".
3. **Broaden the review.** Add a wider UX walkthrough beyond the verify items: edge states, error messages, consistency with the surroundings, accessibility/readability, small inaccuracies. Suggest concrete things to try.
4. **Collect and record the findings.** Summarize what is OK and what isn't. For each problem, capture what should be fixed. Then **record** the findings: ${reportWrite}.${memoryWrite}
${bodyBlock}${verifyBlock}${stepsBlock}
# After the review
- If everything is fine → say so (the findings in the report confirm it) and recommend continuing to \`/mini:done\` (closing the phase), if it isn't closed yet.
- If the human finds problems → summarize them as concrete tasks (they're already recorded in the report) and recommend going back to \`/mini:do\` to fix them (don't close the phase).

The only thing you write here are the **findings** (into the run report, and for a closed phase also into the memory) — you **do not move** the phase state in \`.mini/state.json\`, that's the job of \`done\`.
`;
}
