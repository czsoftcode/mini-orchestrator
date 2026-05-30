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
  done: 'hotovo',
  doing: 'dělá se',
  todo: 'čeká',
  skipped: 'odloženo',
};

const PHASE_WORD: Record<PhaseStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  planned: 'plán',
  proposed: 'návrh',
  skipped: 'odloženo',
};

export interface NextSessionOptions {
  userHint?: string;
  /** Obsah `.mini/last-memory.md`, pokud existuje. */
  lastMemoryMd?: string;
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
      ? `# Dosavadní postup\n${historyLines.join('\n')}\n`
      : '# Postup\nProjekt je čerstvě založený, žádné fáze ještě nebyly.\n';

  const memory = options.lastMemoryMd?.trim();
  const memoryBlock = memory
    ? `# Poslední fáze\nShrnutí poslední dokončené fáze (co se udělalo, na co dát pozor):\n"""\n${memory}\n"""\n\n`
    : '';

  const hint = options.userHint?.trim();
  const hintBlock = hint
    ? `# Nápad uživatele\nUživatel má představu, kterou chce v další fázi rozpracovat:\n"""\n${hint}\n"""\nPřesně z toho vyjdi. Pokud je nápad příliš velký na jednu fázi (1-3 dny), vyber z něj první smysluplný kus.\n\n`
    : '';

  // Bez nápadu se nejdřív zeptej — uživatel ho mohl zapomenout zadat.
  const askBlock = hint
    ? ''
    : `# Nejdřív se zeptej\nUživatel ti k další fázi nic nezadal. Než cokoli navrhneš, **zeptej se ho**, jestli má pro další fázi vlastní představu (mohl ji omylem nezadat), nebo to má nechat na tobě. Teprve podle odpovědi pokračuj:\n- má-li vlastní nápad → vyjdi přesně z něj,\n- nechá-li to na tobě → navrhni fázi sám podle dosavadního postupu a stavu kódu.\n\n`;

  return `Jsi v Claude Code session a pomáháš uživateli budovat projekt po malých fázích.
Tohle je krok **next** workflow mini — navrhni JEDNU další fázi.

# Projekt
${projectMd.trim()}

${history}
${memoryBlock}${askBlock}${hintBlock}# Tvůj úkol
Navrhni jednu další fázi. Má být malá (1-3 dny práce), s jasným, ověřitelným cílem — ne roadmap, jen jedna věc, co dává smysl udělat hned. ${GRAPH_USAGE_HINT}

Návrh (název max 5 slov + cíl na 1 větu) krátce ukaž uživateli. Po odsouhlasení fázi **ulož** zavoláním (Bash):

\`\`\`
mini next --apply --title "<název>" --goal "<cíl fáze>"
\`\`\`

Stav fáze měň jen tímhle příkazem — nikdy needituj \`.mini/state.json\` ručně.

Pokud projekt považuješ za hotový, nic neukládej a řekni to uživateli.

Po uložení napiš, že další na řadě je \`/mini:discuss\` (prodiskutovat) nebo \`/mini:plan\` (rovnou rozplánovat).
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
  const notesBlock = notes ? `\n# Poznámky k fázi (z diskuse)\n${notes}\n` : '';

  let stepsBlock = '';
  if (phase.steps?.length) {
    const lines = (phase.steps as Step[]).map((s) => `- [${STEP_WORD[s.status]}] ${s.title}`);
    stepsBlock = `\nFáze už má kroky (uložení je přepíše):\n${lines.join('\n')}\n`;
  }

  return `Jsi v Claude Code session a pomáháš uživateli budovat projekt po malých fázích.
Tohle je krok **plan** workflow mini — rozmen aktuální fázi na konkrétní kroky.

# Projekt
${projectMd.trim()}

# Fáze, kterou rozmenujeme
**Fáze ${phase.id}: ${phase.title}**
Cíl: ${phase.goal ?? '(nezadán)'}
${stepsBlock}${notesBlock}
# Tvůj úkol
Rozmen fázi na 3-7 konkrétních kroků. Každý krok má dvě části:

- **title** — krátký, výstižný název (ideálně do 8 slov). Slouží jako kanonický identifikátor kroku (páruje se s reportem), tak ať je stručný a stálý.
- **detail** (volitelný) — delší upřesnění: ověřitelný výstup a kritéria (např. "API endpoint /tasks vrací JSON; pokryto testem"). Sem patří to, co by jinak title nafukovalo.

Každý krok musí mít jasný, ověřitelný výstup (např. "API endpoint /tasks vrací JSON" — ne "udělat backend"); pokud se nevejde do title, dej ho do detailu. ${GRAPH_USAGE_HINT}

Kroky krátce ukaž uživateli. Po odsouhlasení je **ulož** zavoláním (Bash) — jeden krok na řádek ve formátu \`title :: detail\` (oddělovač \` :: \` je volitelný; řádek bez něj je jen title):

\`\`\`
printf '%s\\n' \\
  "<title prvního kroku> :: <detail prvního kroku>" \\
  "<title druhého kroku bez detailu>" \\
  "<title třetího kroku> :: <detail třetího kroku>" | mini plan --apply
\`\`\`

Stav fáze měň jen tímhle příkazem — nikdy needituj \`.mini/state.json\` ručně.

Po uložení napiš, že další na řadě je \`/mini:do\` (implementovat fázi).
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
    return `Jsi v Claude Code session — krok **done** workflow mini.

Fáze **${phase.id}: ${phase.title}** zatím nemá report z implementace (\`.mini/run/phase-${phase.id}.md\` chybí).
Bez reportu nelze stav posunout neinteraktivně. Nejdřív spusť \`/mini:do\` (implementovat fázi a zapsat report), pak se vrať k \`/mini:done\`.
`;
  }

  const bodyBlock = reportBody?.trim()
    ? `\n# Report z implementace\n${reportBody.trim()}\n`
    : '';

  let verifyBlock: string;
  let applyHint: string;
  if (verify.length > 0) {
    const lines = verify.map((v, i) => {
      const detail = v.detail ? `\n     ${v.detail}` : '';
      return `  ${i + 1}. ${v.title}${detail}`;
    });
    verifyBlock = `\n# Body k ručnímu ověření\nClaude tyhle věci sám neověřil — projdi je s uživatelem:\n${lines.join('\n')}\n`;
    applyHint = `Až uživatel ověření odsouhlasí, posuň stav (Bash):

\`\`\`
mini done --apply --accept-verify
\`\`\`

Pokud uživatel najde problém, fázi nezavírej — vrať se k \`/mini:do\` a oprav to.`;
  } else {
    verifyBlock = '\n# Body k ručnímu ověření\nClaude žádné neuvedl — ověřil vše sám.\n';
    applyHint = `Zeptej se uživatele, jestli fáze funguje. Po potvrzení posuň stav (Bash):

\`\`\`
mini done --apply
\`\`\``;
  }

  return `Jsi v Claude Code session — krok **done** workflow mini.
Fáze **${phase.id}: ${phase.title}** je hotová z pohledu implementace.

# Tvůj úkol
Lidská verifikace: krátce shrň uživateli, co se udělalo (viz report níže), a nech ho potvrdit, že to funguje.
${bodyBlock}${verifyBlock}
# Posun stavu
${applyHint}

Stav fáze měň jen příkazem \`mini done --apply\` — nikdy needituj \`.mini/state.json\` ručně. \`mini done --apply\` přečte report, posune kroky, fázi uzavře, navýší verzi v package.json (default patch) a commitne práci.

Verze a push:
- Větší skok verze (po dohodě s uživatelem) přidej \`--bump minor\` nebo \`--bump major\`.
- Nahrání na remote je opt-in: když to uživatel chce, přidej \`--push\` (jinak práce zůstane jen v lokálním commitu).

Po uzavření napiš, že další na řadě je \`/mini:next\` (navrhnout další fázi), a **nabídni uživateli příkaz \`/clear\`** pro vyčištění kontextu Claude Code před další fází (\`/clear\` musí napsat on sám).
`;
}
