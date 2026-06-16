import { stripFindingsSections } from '../state/runReport.js';
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

/** A single open review finding, surfaced as a candidate for the next phase. */
export interface OpenFinding {
  /** Stable finding id (`{phaseId}-{n}`, e.g. `155-1`). */
  id: string;
  severity: string;
  /** Which review step found it (`adversarial` | `verify`). */
  source: string;
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
  /** Open review findings (adversarial + verify), offered as candidate fix phases. */
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

  // Open review findings — what the adversarial red-team (`/mini:adversarial`) or
  // the human UI/UX review (`/mini:verify`) flagged on earlier phases and nobody
  // has closed yet. Each line is tagged with its source. Any of these can become
  // the next (fix) phase. Saving with `--from-finding <id>` records the link on
  // the phase (so `discuss`/`plan` can pull in the finding's full detail) but does
  // NOT resolve the finding — it stays open until the fix is done and verified.
  const openFindings = (options.openFindings ?? [])
    .map((f) => ({
      id: f.id.trim(),
      severity: f.severity.trim(),
      source: f.source.trim(),
      where: f.where?.trim(),
      title: f.title.trim(),
    }))
    .filter((f) => f.id && f.title);
  const findingsBlock =
    openFindings.length > 0
      ? `# Open review findings\nThe review steps (\`/mini:adversarial\`, \`/mini:verify\`) left these findings open — any could become the next (fix) phase:\n${openFindings
          .map(
            (f) =>
              `- ${f.id} · ${f.severity} · ${f.source}${f.where ? ` · ${f.where}` : ''} — ${f.title}`,
          )
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

If the phase comes from a backlog item above, append \`--from-todo <n>\` (its bracketed number) so that item is ticked off in the archive automatically. If it fixes an open review finding above, append \`--from-finding <id>\` (the finding's id) so the phase records the link for \`discuss\`/\`plan\` (this does not close the finding).

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
  /**
   * Open review findings (adversarial + verify) offered for closing at this
   * checkpoint. Several classes are filtered out (see `buildDoneSessionPrompt`):
   * the phase's own linked `fromFinding`, findings raised *against* this phase
   * (origin == this phase — not fixed *by* it), and findings already owned by
   * another phase's `fromFinding`. Empty/absent → no block.
   */
  openFindings?: OpenFinding[];
  /**
   * Finding ids already linked as some phase's `fromFinding` across the project
   * (any phase, including this one). Such findings belong to that fix-phase and
   * must not be offered for closing here — closing one would make that phase's
   * own `done` a no-op and break undo symmetry. Absent → none linked.
   */
  linkedFindingIds?: string[];
}

/**
 * Origin phase id encoded in a finding id (`{phaseId}-{n}` → phaseId). Returns
 * `NaN` for an unparseable id, which never equals a real phase id.
 */
function findingOriginPhase(id: string): number {
  return Number.parseInt(id.split('-')[0] ?? '', 10);
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

  // Strip stale `## Adversarial findings` / `## Verify findings` sections left in
  // older reports so repeated reviews don't read prior verdicts as the impl log.
  const cleanBody = reportBody ? stripFindingsSections(reportBody) : '';
  const bodyBlock = cleanBody ? `\n# Implementation report\n${cleanBody}\n` : '';

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

  // Open review findings to offer for closing at this checkpoint. Closing one is
  // opt-in and needs an explicit human OK ("yes, this phase fixed 167-7"); never
  // assume. We drop three classes that must NOT be offered:
  //   1. the phase's own linked `fromFinding` — it auto-closes on `mini done`;
  //   2. findings raised *against* this phase (origin == this phase) — by
  //      definition not fixed *by* it, so offering them invites closing a real
  //      open issue;
  //   3. findings already owned by another phase's `fromFinding` — closing one
  //      here would make that fix-phase's own `done` a no-op and break undo
  //      symmetry (its reopen vs. this phase's `resolvedFindings`).
  const linked = new Set(input.linkedFindingIds ?? []);
  const findings = (input.openFindings ?? [])
    .map((f) => ({
      id: f.id.trim(),
      severity: f.severity.trim(),
      source: f.source.trim(),
      where: f.where?.trim(),
      title: f.title.trim(),
    }))
    .filter(
      (f) =>
        f.id &&
        f.title &&
        f.id !== phase.fromFinding &&
        !linked.has(f.id) &&
        findingOriginPhase(f.id) !== phase.id,
    );
  const findingsBlock =
    findings.length > 0
      ? `\n# Open review findings\nThese review findings are still open. **Only if** the user confirms this phase also fixed one, close it at this checkpoint — append \`--resolve-finding <id>\` to \`mini done --apply\` (repeatable). Do not assume; ask, and leave unrelated findings open. \`mini undo\` reopens whatever you close here.\n${findings
          .map(
            (f) =>
              `- ${f.id} · ${f.severity} · ${f.source}${f.where ? ` · ${f.where}` : ''} — ${f.title}`,
          )
          .join('\n')}\n`
      : '';

  return `You are in a Claude Code session — the **done** step of the mini workflow.
Phase **${phase.id}: ${phase.title}** is finished from an implementation standpoint.

# Your task
Human verification: briefly summarize for the user what was done (see the report below) and let them confirm that it works.
${bodyBlock}${verifyBlock}${findingsBlock}
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
   * Is the phase already closed (status `done`)? Switches the opening frame: a
   * closed phase gets a retrospective in-depth review, an open one a check before
   * `done`.
   */
  phaseDone: boolean;
  /** Items to verify manually, drawn from the run report — the skeleton of the review. */
  verify: { title: string; detail?: string }[];
  /** Free text from the run report (notes for the human), when it parses. */
  reportBody?: string;
}

/**
 * Prompt for `/mini:verify` — an interactive in-depth UI/UX review of the phase
 * led by a human. Unlike `done` (where verification happens in passing), here
 * Claude **actively guides** the human through the review: it walks the verify
 * items from the report, adds a broader UX pass and collects findings. Findings
 * are recorded via `mini findings add --source verify` into the durable
 * `.mini/findings/` store (the same store the adversarial step uses), so they
 * survive a corrupt/missing report and a closed phase and feed later phases via
 * `mini next`. The phase state is **not** moved — that is `done`'s job.
 */
export function buildVerifySessionPrompt(input: VerifySessionInput): string {
  const { phase, phaseDone, verify, reportBody } = input;

  const frame = phaseDone
    ? `**Phase ${phase.id}: ${phase.title}** is already closed — this is a **retrospective in-depth review** of its UI/UX by a human.`
    : `**Phase ${phase.id}: ${phase.title}** is implemented but not yet closed — go through its UI/UX with a human **before you close it in \`done\`**.`;

  // Strip stale `## Adversarial findings` / `## Verify findings` sections left in
  // older reports so repeated reviews don't read prior verdicts as the impl log.
  const cleanBody = reportBody ? stripFindingsSections(reportBody) : '';
  const bodyBlock = cleanBody ? `\n# Implementation report\n${cleanBody}\n` : '';

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

  return `You are in a Claude Code session — the **verify** step of the mini workflow.
${frame}

# Your task
Take the human through an **in-depth UI/UX review** of this phase. You're not here for machine tests (those belong in \`do\`), but for things only a human can judge: visual appearance, clarity, the smoothness of the UX flow, small details and the overall impression. Proceed interactively — **ask one at a time**, let the human react, and only then continue. ${ASK_AND_STOP_HINT}

1. **Set the scene.** From the phase goal, the steps and the report below, determine what specifically should be reviewed and how the human will see it (which command/screen/output to run). When something needs to be started up (build, dev server, sample input), propose the exact steps.
2. **Go through the verify items.** Take the items from the report as a skeleton and for each let the human confirm that it looks and behaves correctly. Actively ask about details, not just "does it work?".
3. **Broaden the review.** Add a wider UX walkthrough beyond the verify items: edge states, error messages, consistency with the surroundings, accessibility/readability, small inaccuracies. Suggest concrete things to try.
4. **Collect and record the findings.** Summarize what is OK and what isn't. For each problem, **record** it by calling the CLI — it owns the durable findings store, the format and the origin phase, so you do not write or edit any file yourself:

\`\`\`
mini findings add --source verify --severity <blocker|should-know|nit> --title "<short headline>" [--where "<file:line or screen>"] [--body "<what's wrong and how to fix>"]
\`\`\`

   Run it once per finding; it prints the assigned id and the file under \`.mini/findings/\`. These findings are **durable and feed later phases** — they show up in \`mini next\`, unlike the old run report where a closed or corrupt report buried them. If \`mini\` is not on your PATH, say so in the chat instead of writing the findings into some file.
${bodyBlock}${verifyBlock}${stepsBlock}
# After the review
- If everything is fine → say so (record nothing) and recommend continuing to \`/mini:done\` (closing the phase), if it isn't closed yet.
- If the human finds problems → summarize them as concrete tasks (already recorded via \`mini findings add\`) and recommend going back to \`/mini:do\` to fix them (don't close the phase).

The only thing you record here are the **findings** (via \`mini findings add --source verify\`) — you **do not move** the phase state in \`.mini/state.json\`, that's the job of \`done\`.
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
  // Strip stale findings sections first so a re-run doesn't stack prior verdicts.
  const cleanBody = reportBody ? stripFindingsSections(reportBody) : '';
  const bodyBlock = cleanBody
    ? `\n# Implementation report\n${cleanBody}\n`
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

/** A single phase in the review range, reduced to its identity (id + title). */
export interface AdversarialProjectPhase {
  id: number;
  title: string;
}

/**
 * A human label for the reviewed phase range: \`first-last\`, or just \`first\`
 * when both ends are the same phase (a one-phase range). Used to fill the
 * \`mini findings add --range\` flag so range-review findings record their scope.
 */
function rangeLabelFrom(first: number, last: number): string {
  return first === last ? `${first}` : `${first}-${last}`;
}

export interface AdversarialProjectInput {
  /** Contents of \`.mini/project.md\` (the project vision) — context for the reviewer. */
  projectMd: string;
  /** Resolved range start — a full commit SHA for \`git diff <fromSha>..<toSha>\`. */
  fromSha: string;
  /** Resolved range end — a full commit SHA for \`git diff <fromSha>..<toSha>\`. */
  toSha: string;
  /**
   * Phases covered by the range, as id+title only (NOT full reports). Empty when
   * the range was given as plain git refs and the phases can't be mapped to it —
   * the prompt then tells the reviewer to lean on the diff alone.
   */
  phases: AdversarialProjectPhase[];
}

/**
 * Prompt for \`mini adversarial-project\` — an independent red-team review of a
 * **range of phases** (a slice of git history), not a single phase. Unlike
 * \`adversarial\` (which scopes to the current/last phase and inlines its run
 * report), this one is a deliberately **thin index**: it points the reviewer at
 * the project vision, the resolved range and the explicit \`git diff\` to run, plus
 * a bare id+title list of the phases in range — it does **not** dump the phase
 * reports. The reviewer reads the real diff themselves.
 *
 * Three behavioural rules are baked in: (1) **dedup first** — run
 * \`mini findings list\` before recording so the same issue isn't filed twice;
 * (2) **security is out of scope here** — delegate it to \`/security-review\`;
 * (3) findings are written via \`mini findings add --source project\`, which owns
 * the durable \`.mini/findings/\` store — the reviewer never edits a file itself.
 *
 * Pure: takes everything it needs as input, does no I/O. The assembler
 * (\`buildProjectAdversarialContext\`) resolves the range and reads project.md.
 */
export function buildProjectAdversarialSessionPrompt(input: AdversarialProjectInput): string {
  const { projectMd, fromSha, toSha, phases } = input;

  const phaseList =
    phases.length > 0
      ? phases.map((p) => `  - ${p.id}. ${p.title}`).join('\n')
      : '  (the range was given as plain git refs — no phase list; work from the diff)';

  // The phase range as a human label (`first-last`, or a single id when the range
  // is one phase). Empty in ref mode (no phases mapped) — then the prompt omits
  // the `--range` flag entirely and the reviewer files findings without it.
  const rangeLabel =
    phases.length > 0 ? rangeLabelFrom((phases[0] as AdversarialProjectPhase).id, (phases[phases.length - 1] as AdversarialProjectPhase).id) : '';
  const rangeFlag = rangeLabel ? ` --range "${rangeLabel}"` : '';

  return `You are in a Claude Code session — an **adversarial project review** (a cross-phase red-team).

# What this is
A red-team review of a **range of phases** at once — a slice of the project's
history, not a single phase. You review the combined change \`${fromSha}..${toSha}\`.

# Your role — an independent reviewer who did NOT write this code
Switch into the role of an independent reviewer who did **not** write this code.
Your job is **not** to confirm that it works — your job is to find what breaks it
across the whole range: regressions one phase introduced into another, half-done
refactors, contradictions between phases, drift from the project's stated goals.
Assume there is a bug in there. Be concrete and skeptical, not reassuring.

# The range under review
Phases in range (id + title only — read the real code, not these labels):
${phaseList}

Read the **actual diff** for the whole range — don't guess from the titles:

\`\`\`
git diff ${fromSha}..${toSha}
\`\`\`

Use \`git log ${fromSha}..${toSha}\` and \`git show <sha>\` for per-commit history when
you need it, then read the changed code. ${GRAPH_USAGE_HINT}

# Before you record anything — deduplicate
Other reviews may already have filed some of these. **First** list what's already
on record and do **not** re-file an issue that's already there:

\`\`\`
mini findings list
\`\`\`

# Go through these, in order
1. **UNHAPPY PATH** — what happens on empty, corrupt or unexpected input,
   null/undefined, a timeout, concurrency? Show a concrete input that knocks it over.
2. **CROSS-PHASE CONSISTENCY** — does a later phase leave an earlier one
   half-migrated? Are there two ways to do the same thing now? Dead code or a
   contract one phase changed and another still relies on?
3. **SILENT ASSUMPTIONS** — where does the code assume a type, a shape of data or a
   state without checking it? Where can errors cascade silently instead of failing loudly?
4. **DRIFT FROM THE PROJECT** — does the range pull against the project's stated
   approach, non-goals or success criteria (see the project block below)?
5. **TESTS** — do they test failure too, or only the happy path? What is NOT covered?

For every finding give: **where** (file:line), **how it shows up**, and **how
serious** it is. Don't write a generic "looks good": if you genuinely find
nothing, list **concretely** what you checked and how.

# Security is out of scope here
Do **not** attempt a security audit in this review — that is a separate, dedicated
pass with its own report (\`mini security\`). Don't run it from here and don't file
security findings from here; just note in the chat that it still needs to happen.

# Record the findings
Record **each** finding by calling the CLI — it owns the store, the format and the
origin, so you do not write or edit any file yourself:

\`\`\`
mini findings add --source project${rangeFlag} --severity <blocker|should-know|nit> --title "<short headline>" [--where "<file:line>"] [--body "<what breaks and how>"]
\`\`\`

${
  rangeLabel
    ? `Keep \`--range "${rangeLabel}"\` on **every** finding: it records the whole phase range this review covered, so a later reader sees the scope you inspected — not just the single origin phase the finding is filed under.`
    : 'This range was given as plain git refs (no phase numbers), so omit `--range` — there is no phase range to record.'
}

Run it once per finding; it prints the assigned id and the file under
\`.mini/findings/\`. If \`mini\` is not on your PATH, say so in the chat instead of
writing the findings into some file.

When you are done, print a single **status line** to the human — exactly one of:
\`**adversarial-project: pass**\` (you reviewed it and found nothing worth recording),
\`**adversarial-project: findings**\` (you recorded findings — say how many) or
\`**adversarial-project: blocked**\` (you couldn't complete the review — say why).

# Reminder — security is still a separate pass
This review covered **correctness only**. A security audit has **not** run. Remind
the human (don't run it yourself): once this phase is **done and committed**, run
\`mini security\` in a **separate terminal** so it reviews the finished, committed
range with a clean context and writes its own report. Leave this as a reminder — do
not start it from here and do not file security findings into \`mini findings\`.

# Project
${projectMd.trim()}

# Scope — report only
You **only report**. Do **not** modify, fix or refactor the source code, and do
**not** move any phase state: calling \`mini findings add\` is the *only* thing you
write. Fixing what you find is a separate, human-driven step.
`;
}

export interface SecurityReviewInput {
  /** Contents of \`.mini/project.md\` — context the threat model leans on. */
  projectMd: string;
  /** Resolved range start — a full commit SHA for \`git diff <fromSha>..<toSha>\`. */
  fromSha: string;
  /** Resolved range end — a full commit SHA for \`git diff <fromSha>..<toSha>\`. */
  toSha: string;
  /**
   * Phases covered by the range, id+title only (NOT full reports). Empty when the
   * range came as plain git refs that can't be mapped to phases — the prompt then
   * leans on the diff alone. Reuses the adversarial-project phase shape.
   */
  phases: AdversarialProjectPhase[];
  /**
   * Where the reviewer must write the durable report, e.g.
   * \`.mini/security/range-10-11.md\`. Computed by the caller (the future CLI),
   * NOT derived here — the builder only interpolates it into the prompt.
   */
  outputPath: string;
}

/**
 * Prompt for the mini-native **security review** of a **range of phases**. A
 * deliberately separate pass from the correctness red-team (\`adversarial\` /
 * \`adversarial-project\`): same thin-index shape (project vision, resolved range,
 * the explicit \`git diff\` to run, a bare id+title phase list) but a security lens
 * — process execution, filesystem, untrusted \`.mini/\` parsing, prompt-injection,
 * dependency surface — with a project-specific threat model baked in.
 *
 * Two contracts differ from adversarial-project: (1) the reviewer **writes the
 * report file itself** (a durable Markdown report at \`outputPath\`), it does NOT
 * call \`mini findings add\` — security stays a separate output by design;
 * (2) OWASP/CWE categories are used only as a checklist vocabulary. Written in our
 * own words (MIT-clean) — not derived from any external security-audit prompt.
 *
 * Pure: takes everything as input, does no I/O. The assembler
 * (\`buildSecurityReviewContext\`) resolves the range and reads project.md.
 */
export function buildSecurityReviewSessionPrompt(input: SecurityReviewInput): string {
  const { projectMd, fromSha, toSha, phases, outputPath } = input;

  const phaseList =
    phases.length > 0
      ? phases.map((p) => `  - ${p.id}. ${p.title}`).join('\n')
      : '  (the range was given as plain git refs — no phase list; work from the diff)';

  return `You are in a Claude Code session — a **security review** of a slice of this project's history.

# What this is
An independent security pass over the combined change \`${fromSha}..${toSha}\` — a
range of phases reviewed through a **security lens only**, not for correctness.
This is a separate, dedicated pass: the correctness red-team runs elsewhere
(\`mini adversarial\` / \`mini adversarial-project\`).

# Your role — an independent security reviewer
Switch into the role of a security reviewer who did **not** write this code. Your
job is to find where a malicious input, a hostile argument or a poisoned
repository could make this code do something it shouldn't. Assume the worst-case
input. A finding is only useful if you can name the **file**, the **line** and the
concrete **path** by which an attacker reaches it.

# Threat model — what is actually attackable here
\`mini\` is a **local developer CLI**. Keep the realistic attack surface in mind so
the review isn't spent on threats that don't apply:
- There is **no network listener, no authentication, no session, no secret
  storage** — \`mini\` relies on the developer's existing Claude auth. So most
  classic web / authz / session categories simply do not apply.
- The meaningful **untrusted input** is: (a) the contents of a **git-shared
  \`.mini/\`** directory from a cloned or pulled repo — \`project.md\`, phase
  titles/goals, discuss and run reports — which \`mini\` assembles into prompts and,
  in \`auto\` / \`acceptEdits\` mode, feeds to a Claude session that can edit files
  and run tools; and (b) the **CLI arguments and working-tree files** the tool
  reads.
- So the categories that matter most here are **command / argument injection**
  into spawned processes (git, claude), **path traversal / arbitrary file write
  or read** out of the repo, **unsafe parsing** of untrusted \`.mini/\` content,
  **prompt-injection / agent-trust** via shared \`.mini/\`, and the **dependency
  surface**. Use OWASP / CWE categories as a checklist, but report only what is
  **reachable in THIS code** — not generic textbook risk.

# The range under review
Phases in range (id + title only — read the real code, not these labels):
${phaseList}

Read the **actual diff** for the whole range — don't guess from the titles:

\`\`\`
git diff ${fromSha}..${toSha}
\`\`\`

Use \`git log ${fromSha}..${toSha}\` and \`git show <sha>\` for per-commit history
when you need it, then read the changed code. ${GRAPH_USAGE_HINT}

# Go through these, in order
1. **PROCESS EXECUTION** — every spawned command (git, claude, shell). Is any
   argument or env value built from untrusted \`.mini/\` content or working-tree
   data and not passed as a separate argv element? Look for shell interpolation,
   \`shell: true\`, unquoted expansion.
2. **FILESYSTEM** — every read/write path. Can untrusted input steer a write or
   read outside the repo (\`..\`, absolute paths, symlinks)? Is any path joined
   from data the attacker controls?
3. **UNTRUSTED PARSING** — JSON / markdown / state parsed from \`.mini/\`. What
   happens on malformed, oversized or hostile input — crash, silent corruption,
   or worse?
4. **PROMPT INJECTION / AGENT TRUST** — where does shared \`.mini/\` content flow
   into a Claude prompt that then runs with tool access? Note where the human
   checkpoint is the only thing between a poisoned repo and an action.
5. **DEPENDENCY SURFACE** — new or risky third-party packages introduced in the
   range; anything that runs at install time or widens the attack surface.

For every finding give: **where** (file:line), **how it is reached** (the concrete
path from untrusted input to the sink), and **how serious** it is. If a category
is clean, say so **concretely** — what you checked and why it is safe — don't
write a generic "looks fine".

# Record the review — you write the report yourself
Unlike the other reviews, here you **write the report file directly** (you do NOT
file into the findings store — security is a separate output). Write a durable
Markdown report to:

\`\`\`
${outputPath}
\`\`\`

Use **exactly** this structure (it mirrors the existing \`.mini/security/\` reports
so they stay consistent and comparable):

\`\`\`
# Security review — <range>

- **Range:** \`git diff ${fromSha}..${toSha}\`
- **Reviewed at:** <current HEAD / version>
- **Method:** <what you focused on; say plainly if it was the security sinks and
  not an exhaustive line-by-line audit>
- **Threat model:** <one short paragraph — the attack surface above as it applies
  to THIS range>

## Verdict
<one or two sentences: clean, or N findings at what severity>

## Findings
### SEC-1 · <blocker|should-know|nit> · <short headline>
**Where:** <file:line>

<what is reachable and how; the concrete attacker path; a suggested direction —
but do NOT change the code>

(repeat SEC-2, SEC-3, … — omit this section entirely if there are no findings)

## Checked and clean
<the sinks / categories you checked and found safe, one line of why each — so a
later reviewer knows what was already covered>
\`\`\`

Severities match the rest of \`mini\`: **blocker** (exploitable / data loss),
**should-know** (a real weakness, conditions apply), **nit** (informational /
defense-in-depth). Number findings \`SEC-1\`, \`SEC-2\`, … within this report.

When the report is written, print a single **status line** to the human — exactly
one of: \`**security-review: pass**\` (reviewed, nothing worth recording),
\`**security-review: findings**\` (you wrote findings — say how many) or
\`**security-review: blocked**\` (couldn't complete — say why). State the path of
the report you wrote.

# Project
${projectMd.trim()}

# Scope — review and report only
You **only review and write the one report file** at the path above. Do **not** modify,
fix or refactor the source code, and do **not** move any phase state. Writing
\`${outputPath}\` is the *only* file you create. Fixing what you find is a separate,
human-driven step.
`;
}
