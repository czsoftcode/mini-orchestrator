import { phaseStem } from '../state/store.js';
import type { Phase, PhaseStatus, ProjectState, Step, StepStatus } from '../state/types.js';
import { GRAPH_USAGE_HINT } from './graphHint.js';
import { type LinkedFindingInput, renderLinkedFindingBlock } from './linkedFinding.js';
import { ASK_AND_STOP_HINT, VERBATIM_OUTPUT_HINT } from './sessionHints.js';
import { projectRefBlock } from './projectRef.js';

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

/** A single open adversarial finding, surfaced as a candidate for the next phase. */
export interface OpenFinding {
  /** Stable finding id (`{phaseId}-{n}`, e.g. `155-1`). */
  id: string;
  severity: string;
  /** Optional location (`file:line`). */
  where?: string;
  /** Short headline of the finding. */
  title: string;
}

export interface NextSessionOptions {
  userHint?: string;
  /** Obsah `.mini/last-memory.md`, pokud existuje. */
  lastMemoryMd?: string;
  /** Open items from the `.mini/todo.md` archive, offered as candidate ideas. */
  openTodos?: OpenTodo[];
  /** Open adversarial findings, offered as candidate fix phases. */
  openFindings?: OpenFinding[];
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
    : `# Ask first\nThe user gave you nothing for the next phase. Before you propose anything, **ask them** whether they have their own idea for the next phase (they may have forgotten to provide it), or whether to leave it up to you. ${ASK_AND_STOP_HINT} Only then continue based on the answer:\n- if they have their own idea → start from exactly that,\n- if they leave it to you → sketch **2-3** candidate ideas based on the progress so far and the state of the code; propose the most sensible one as the phase, and **offer to stash the rest** into the project's ideas archive with \`mini todo add "<text>"\` (one call per idea, only after the user approves) so they aren't lost.\n\n`;

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

  // Open adversarial findings — what the red-team flagged on earlier phases and
  // nobody has closed yet. Any of these can become the next (fix) phase. Saving
  // with `--from-finding <id>` records the link on the phase (so `discuss`/`plan`
  // can pull in the finding's full detail) but does NOT resolve the finding — it
  // stays open until the fix is done and verified. Say so plainly.
  const openFindings = (options.openFindings ?? [])
    .map((f) => ({ id: f.id.trim(), severity: f.severity.trim(), where: f.where?.trim(), title: f.title.trim() }))
    .filter((f) => f.id && f.title);
  const findingsBlock =
    openFindings.length > 0
      ? `# Open adversarial findings\nThe red-team review (\`/mini:adversarial\`) left these findings open — any could become the next (fix) phase:\n${openFindings
          .map((f) => `- ${f.id} · ${f.severity}${f.where ? ` · ${f.where}` : ''} — ${f.title}`)
          .join(
            '\n',
          )}\nIf one warrants the next phase, propose a fix phase for it and save it with \`--from-finding <id>\` (the finding's id, e.g. \`155-1\`) so the phase durably records which finding it fixes — \`discuss\`/\`plan\` then read that finding's full detail. This does **not** close the finding (no auto-resolve); it stays listed until the fix is done and verified.\n\n`
      : '';

  return `You are in a Claude Code session helping the user build a project in small phases.
This is the **next** step of the mini workflow — propose ONE next phase.

# Project
${projectMd.trim()}

${history}
${memoryBlock}${todoBlock}${findingsBlock}${askBlock}${hintBlock}# Your task
Propose one next phase. It should be small (1-3 days of work), with a clear, verifiable goal — not a roadmap, just one thing that makes sense to do right now. ${GRAPH_USAGE_HINT}

Show the proposal (name, max 5 words + goal in 1 sentence) to the user in your final message and ask for approval. ${ASK_AND_STOP_HINT} Only after they approve, **save** the phase by calling (Bash):

\`\`\`
mini next --apply --title "<name>" --goal "<phase goal>"
\`\`\`

If the phase comes from a backlog item above, append \`--from-todo <n>\` (its bracketed number) so that item is ticked off in the archive automatically. If it fixes an open adversarial finding above, append \`--from-finding <id>\` (the finding's id) so the phase records the link for \`discuss\`/\`plan\` (this does not close the finding).

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
  useProjectRef = false,
  linkedFinding?: LinkedFindingInput,
): string {
  const notes = discussNotes?.trim();
  const notesBlock = notes ? `\n# Phase notes (from discussion)\n${notes}\n` : '';
  const projectBlock = useProjectRef ? projectRefBlock() : projectMd.trim();
  const findingBlock = linkedFinding ? `\n${renderLinkedFindingBlock(linkedFinding)}` : '';

  let stepsBlock = '';
  if (phase.steps?.length) {
    const lines = (phase.steps as Step[]).map((s) => `- [${STEP_WORD[s.status]}] ${s.title}`);
    stepsBlock = `\nThe phase already has steps (saving will overwrite them):\n${lines.join('\n')}\n`;
  }

  return `You are in a Claude Code session helping the user build a project in small phases.
This is the **plan** step of the mini workflow — break the current phase down into concrete steps.

# Project
${projectBlock}

# Phase to break down
**Phase ${phase.id}: ${phase.title}**
Goal: ${phase.goal ?? '(not set)'}
${stepsBlock}${notesBlock}${findingBlock}
# Your task
Break the phase down into 3-7 concrete steps. Each step has two parts:

- **title** — a short, descriptive name (ideally up to 8 words). It serves as the step's canonical identifier (it's paired with the report), so keep it concise and stable.
- **detail** (optional) — a longer clarification: verifiable output and criteria (e.g. "API endpoint /tasks returns JSON; covered by a test"). This is where things that would otherwise bloat the title belong.

Each step must have a clear, verifiable output (e.g. "API endpoint /tasks returns JSON" — not "build the backend"); if it doesn't fit in the title, put it in the detail. ${GRAPH_USAGE_HINT}

Show the full list of steps (titles + details) to the user in your final message and ask for approval. ${ASK_AND_STOP_HINT} Only after they approve, **save** the steps by calling (Bash) — one step per line in the format \`title :: detail\` (the \` :: \` separator is optional; a line without it is just a title):

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

/**
 * Prompt pro `/mini:project` — Claude vede s uživatelem plánovací rozhovor a
 * obohatí **existující** `.mini/project.md` o sekce Approach / Non-goals /
 * Success criteria. Vychází z aktuálního project.md (vložen celý), zachová
 * What / Who / Constraints a uloží přes kontrakt `mini project --apply` (heredoc).
 * Stav fáze neřeší — píše jen project.md.
 */
export function buildProjectSessionPrompt(projectMd: string): string {
  return `You are in a Claude Code session helping the user shape their project.
This is the **project** step of the mini workflow — a plan-before-code interview that **enriches the existing \`.mini/project.md\`** with Approach, Non-goals and Success criteria. It runs after \`mini init\`, so the project already exists.

# Current project
This is what \`.mini/project.md\` says right now — your starting point. **Do not ask the user to describe the idea again; you already have it here.** Build on it.
"""
${projectMd.trim()}
"""

# Your task
Run a short plan-before-code interview, then save the result. **Do not write any code.** Be **critical, not agreeable** — for every meaningful choice give the pros, the cons and at least one alternative; if an idea is weak, say so and say why, don't just reassure. Ask **one small batch of questions at a time** so the user can actually answer. ${ASK_AND_STOP_HINT} Keep the result **concise**: \`project.md\` is a one-page steering doc, not a full spec — only the main points that come out of the discussion get written, not every detail.

Go through four stages:

1. **Frame & remove your assumptions.** Briefly reflect back what the project is (from the current project.md above), then ask the questions you need to drop your own assumptions — about the users, the core workflow, the data and the screens. Small batches.
2. **Draft a rough plan & weigh the decisions.** Propose a short, rough plan: the main user and their main job, 3-5 core flows, the key data objects, the main screens, and the risky unhappy paths (things that could corrupt data, leak permissions or cost money). For each major decision give the trade-off and an alternative, and ask "why this over the simplest possible version?". This feeds the **Approach** section (distilled) and may sharpen **What I'm building**.
3. **Non-goals & guardrails.** Turn everything you agreed to leave out into **Non-goals**, each phrased as a rule the project can keep in front of you later (e.g. "Do not add X in this version."). Then list what **you** would be tempted to add that the user did **not** ask for — extra features, structure, integrations — and for each recommend build-now or leave-out; the leave-outs become more non-goals.
4. **Final check & success criteria.** Ask: "is there any question that, answered wrong, would send us down the wrong path?" — if there is, ask it now. Then agree the **Success criteria** (how we'll know it's done and good). Finally show the **full draft project.md** (verbatim, the whole file) for approval — end your turn there and save only after the user approves in a later message.

# Saving (after the user approves)
Save via the \`mini project --apply\` contract (Bash, heredoc). **Keep the existing NAME / FOR_WHOM / CONSTRAINTS** from the project.md above unchanged, unless the user explicitly asked to change them — the command does a full replace, so anything you omit is lost. Every label starts at column 0; omit an optional label entirely when its section is empty:

\`\`\`
mini project --apply <<'EOF'
NAME: <keep the existing name>
WHAT: <the sharpened one-liner>
FOR_WHOM: <keep the existing target user>
CONSTRAINTS: <keep the existing constraints>
APPROACH:
- <main approach points>
NON_GOALS:
- Do not <…> in this version.
SUCCESS:
- <how we'll know it's done / good>
EOF
\`\`\`

This writes only \`.mini/project.md\` — it never touches \`.mini/state.json\`. After saving, tell the user it's updated and suggest \`/mini:next\` to propose the next phase.
`;
}

/**
 * Prompt pro `/mini:decision` — on-demand zápis decision record (ADR) k aktuální
 * fázi. Drží **celou** instrukci k sepsání ADR (dřív žila v `done` promptu, kde
 * se platila každou fázi). Načte se jen když ji člověk vědomě vyvolá; běžný cyklus
 * (`do`/`done`) na ni jen tence ukazuje. Zápis dělá `mini decision --apply`, který
 * cílí na aktuální fázi a odmítá už uzavřenou — tj. musí proběhnout před `done`.
 */
export function buildDecisionSessionPrompt(phase: Phase): string {
  return `You are in a Claude Code session — the **decision** step of the mini workflow.
You record a decision (ADR) behind phase **${phase.id}: ${phase.title}** — the *why* of a non-trivial choice, so it isn't lost.

# When to write one — only on a real crossroads
The **default is to write nothing.** Most phases carry no ADR. Write one **only**
when this phase made a non-trivial decision: a concrete alternative was weighed
and **rejected**, and the choice would not be obvious from the code half a year
later (an architectural/contract call, a deliberate trade-off). Routine choices
(naming, a loop style, an obvious library) get **no** ADR — do not invent a
decision just to fill the file. If there was no real crossroads, say so and write
nothing.

This is **not** the CHANGELOG: the CHANGELOG says *what* changed for users, the
ADR says *why* this path was chosen over another. Don't duplicate the text.

# How to record it
1. Draft a lean ADR and **show it to the user** in the chat for edits/approval —
   never write it silently. ${ASK_AND_STOP_HINT} Structure:
   \`\`\`
   # <short decision title>

   ## Decision
   <what was decided, 1-3 sentences>

   ## Why
   <the rejected alternative and the reason this path won>
   \`\`\`
2. After the user approves, write it (Bash) **before** \`/mini:done\` closes the
   phase, so it lands in the phase commit:
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
   It targets the current phase (${phase.id}), so it must run before the state
   moves. An empty body or a body without a \`# \` heading writes nothing (then
   just continue).
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
    verifyBlock = `\n# Items for manual verification\nClaude did not verify these itself — print the full list to the user and go through it with them:\n${lines.join('\n')}\n`;
    applyHint = `${ASK_AND_STOP_HINT} Only once the user approves the verification, move the state (Bash):

\`\`\`
mini done --apply --accept-verify
\`\`\`

If the user finds a problem, don't close the phase — go back to \`/mini:do\` and fix it.`;
  } else {
    verifyBlock = '\n# Items for manual verification\nClaude listed none — it verified everything itself.\n';
    applyHint = `Ask the user whether the phase works. ${ASK_AND_STOP_HINT} Only after their confirmation, move the state (Bash):

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

# Decision record (ADR)
Did this phase make a **real** decision — a concrete alternative weighed and **rejected**, not obvious from the code later? Then capture the *why* with \`/mini:decision\` **before** \`mini done --apply\` (it lands in the phase commit). Most phases have no such crossroads — write nothing then, and skip this if you already recorded one.

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
Take the human through an **in-depth UI/UX review** of this phase. You're not here for machine tests (those belong in \`do\`), but for things only a human can judge: visual appearance, clarity, the smoothness of the UX flow, small details and the overall impression. Proceed interactively — **ask one at a time**, let the human react, and only then continue. ${ASK_AND_STOP_HINT}

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

export interface AdversarialSessionInput {
  phase: Phase;
  /**
   * Is the phase already closed (status \`done\`)? Switches the opening frame: a
   * closed phase gets a retrospective red-team, an open one a check between \`do\`
   * and \`done\`.
   */
  phaseDone: boolean;
  /** Free text from the run report (what the phase did) — context for the reviewer. Only set when the report is parseable. */
  reportBody?: string;
}

/**
 * Prompt for \`/mini:adversarial\` — an independent red-team review of the code the
 * phase produced. Unlike \`verify\` (a human-led UI/UX review), here the **model
 * itself** switches into the role of a reviewer who did not write the code and
 * hunts for what breaks it (unhappy path, silent assumptions, premature
 * complexity, gaps in tests). It runs in a single pass (it does not ask the user
 * step by step like verify). Each finding is recorded by calling
 * \`mini findings add\`, which owns the durable \`.mini/findings/\` store — the
 * reviewer only reports, never edits the code, and never moves the phase state.
 */
export function buildAdversarialSessionPrompt(input: AdversarialSessionInput): string {
  const { phase, phaseDone, reportBody } = input;

  const frame = phaseDone
    ? `**Phase ${phase.id}: ${phase.title}** is already closed — this is a **retrospective red-team review** of the code it produced.`
    : `**Phase ${phase.id}: ${phase.title}** is implemented but not yet closed — red-team the code it produced **before \`done\` closes it**.`;

  // Inline the report's free text when we have it; otherwise lean on the git diff.
  const bodyBlock = reportBody?.trim()
    ? `\n# Implementation report\n${reportBody.trim()}\n`
    : `\n# Implementation report\nThere is no usable implementation report for this phase — work from the \`git diff\` and the phase goal/steps below, and note that in your findings.\n`;

  const stepsBlock =
    phase.steps && phase.steps.length > 0
      ? `\n# Phase steps\n${phase.steps
          .map((s: Step) => `  - ${s.title}${s.detail ? `\n    ${s.detail}` : ''}`)
          .join('\n')}\n`
      : '';

  return `You are in a Claude Code session — the **adversarial** step of the mini workflow.
${frame}

# Your role — an independent reviewer who did NOT write this code
Switch into the role of an independent reviewer who did **not** write this code.
Your job is **not** to confirm that it works — your job is to find what breaks it.
Assume there is a bug in there. Be concrete and skeptical, not reassuring.

# Look at what actually changed
Don't guess from the report — read the **real diff**: run \`git diff\` (and
\`git log\` / \`git show\` if you need history) to see exactly what this phase
touched, then read the changed code. ${GRAPH_USAGE_HINT}

# Go through these, in order
1. **UNHAPPY PATH** — what happens on empty, corrupt or unexpected input,
   null/undefined, a timeout, concurrency? Show a concrete input that knocks it over.
2. **SILENT ASSUMPTIONS** — where does the code assume a type, a shape of data or a
   state without checking it? Where can errors cascade silently instead of failing loudly?
3. **PREMATURE COMPLEXITY** — is there a layer or abstraction solving a problem that
   doesn't exist yet? What could be simplified without losing function?
4. **TESTS** — if there are any, do they test failure too, or only the happy path?
   What is NOT covered?

For every finding give: **where** (file:line), **how it shows up**, and **how
serious** it is — tag it \`[blocker]\`, \`[should-know]\` or \`[nit]\`. Don't write a
generic "looks good": if you genuinely find nothing, list **concretely** what you
checked and how.

# Record the findings
Record **each** finding by calling the CLI — it owns the store, the format and the
origin phase, so you do not write or edit any file yourself:

\`\`\`
mini findings add --severity <blocker|should-know|nit> --title "<short headline>" [--where "<file:line>"] [--body "<what breaks and how>"]
\`\`\`

Run it once per finding; it prints the assigned id and the file under
\`.mini/findings/\`. These findings are **durable and feed later phases** — unlike
the old run report, they are not buried in a closed phase. If \`mini\` is not on
your PATH, say so in the chat instead of writing the findings into some file.

When you are done, print a single **status line** to the human — exactly one of:
\`**adversarial: pass**\` (you reviewed it and found nothing worth recording),
\`**adversarial: findings**\` (you recorded findings — say how many) or
\`**adversarial: blocked**\` (you couldn't complete the review — say why).
${bodyBlock}${stepsBlock}
# Scope — report only
You **only report**. Do **not** modify, fix or refactor the source code, and do
**not** move the phase state in \`.mini/state.json\`: calling \`mini findings add\` is
the *only* thing you write. Fixing what you find and closing the phase are
separate, human-driven steps (\`do\` / \`done\`), possibly informed by what you found.
`;
}
