import { phaseStem } from '../state/store.js';
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
const STEP_WORD = {
    done: 'hotovo',
    doing: 'dělá se',
    todo: 'čeká',
    skipped: 'odloženo',
};
const PHASE_WORD = {
    done: 'hotovo',
    doing: 'dělá se',
    planned: 'plán',
    proposed: 'návrh',
    skipped: 'odloženo',
};
/**
 * Prompt pro `/mini:next` — Claude navrhne další fázi a uloží ji přes
 * `mini next --apply`. Vstupní bod cyklu: aktuální fáze ještě nemusí existovat.
 */
export function buildNextSessionPrompt(projectMd, state, options = {}) {
    const historyLines = state.phases.map((p) => `- [${PHASE_WORD[p.status]}] ${p.id}. ${p.title}`);
    const history = historyLines.length > 0
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
export function buildPlanSessionPrompt(projectMd, phase, discussNotes) {
    const notes = discussNotes?.trim();
    const notesBlock = notes ? `\n# Poznámky k fázi (z diskuse)\n${notes}\n` : '';
    let stepsBlock = '';
    if (phase.steps?.length) {
        const lines = phase.steps.map((s) => `- [${STEP_WORD[s.status]}] ${s.title}`);
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
/**
 * Prompt pro `/mini:done` — lidská verifikace proběhne přirozeně dotazem v
 * chatu, posun stavu pak udělá `mini done --apply`.
 */
export function buildDoneSessionPrompt(input) {
    const { phase, reportExists, reportBody, verify } = input;
    if (!reportExists) {
        return `Jsi v Claude Code session — krok **done** workflow mini.

Fáze **${phase.id}: ${phase.title}** zatím nemá report z implementace (\`.mini/run/${phaseStem(phase.id)}.md\` chybí).
Bez reportu nelze stav posunout neinteraktivně. Nejdřív spusť \`/mini:do\` (implementovat fázi a zapsat report), pak se vrať k \`/mini:done\`.
`;
    }
    const bodyBlock = reportBody?.trim()
        ? `\n# Report z implementace\n${reportBody.trim()}\n`
        : '';
    let verifyBlock;
    let applyHint;
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
    }
    else {
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
# CHANGELOG
Ještě **před** \`mini done --apply\` zaznamenej, co fáze přinesla, do \`CHANGELOG.md\`
(formát keepachangelog 1.1.0) — commit fáze ho pak automaticky pobere:
- Soubor je v kořeni projektu; když chybí, založ ho s krátkou hlavičkou a sekcí \`## [Unreleased]\`.
- Z reportu vyber změny zajímavé pro uživatele a přidej je pod \`## [Unreleased]\` do podsekcí
  \`### Added\` (nová funkce), \`### Changed\` (změna chování) nebo \`### Fixed\` (oprava) — jen ty, které dávají smysl.
- **Verzi ani datum nedoplňuj** — zůstaň u \`## [Unreleased]\`. Datovanou sekci \`## [verze] - datum\`
  vyrobí až \`mini done --apply --push\` při minor/major vydání; patche se kumulují v Unreleased.
- Čistě interní úpravy bez dopadu na uživatele klidně vynech.

# Posun stavu
${applyHint}

Stav fáze měň jen příkazem \`mini done --apply\` — nikdy needituj \`.mini/state.json\` ručně. \`mini done --apply\` přečte report, posune kroky, fázi uzavře a commitne práci. Verzi v package.json ve výchozím stavu **nenavyšuje** (\`--bump none\`) — vhodné pro dílčí fáze, kde se verze zvedne až na konci celku.

Verze a push:
- Verzi navyš jen na vyžádání (po dohodě s uživatelem): přidej \`--bump patch\`, \`--bump minor\` nebo \`--bump major\`. Bez \`--bump\` (default \`none\`) verze zůstane beze změny.
- Nahrání na remote je opt-in: když to uživatel chce, přidej \`--push\` (jinak práce zůstane jen v lokálním commitu). \`--push\` je vydání, proto **vyžaduje explicitní** \`--bump patch|minor|major\` — s \`none\` (ani bez \`--bump\`) skončí chybou.

Po uzavření napiš, že další na řadě je \`/mini:next\` (navrhnout další fázi), a **nabídni uživateli příkaz \`/clear\`** pro vyčištění kontextu Claude Code před další fází (\`/clear\` musí napsat on sám).
`;
}
/**
 * Prompt pro `/mini:verify` — interaktivní hloubková UI/UX kontrola fáze
 * člověkem. Na rozdíl od `done` (kde verifikace proběhne mimochodem) tady Claude
 * člověka **aktivně vede** kontrolou: projde verify body z reportu, doplní širší
 * UX procházku a posbírá nálezy. Nálezy zapíše do run reportu (a tím i do paměti,
 * kterou `mini done` z reportu skládá); stav fáze ale **neposouvá** — to je `done`.
 */
export function buildVerifySessionPrompt(input) {
    const { phase, phaseDone, verify, reportBody, reportExists } = input;
    const reportRel = `.mini/run/${phaseStem(phase.id)}.md`;
    const memoryRel = `.mini/memory/${phaseStem(phase.id)}.md`;
    const frame = phaseDone
        ? `**Fáze ${phase.id}: ${phase.title}** je už uzavřená — tohle je **zpětná hloubková kontrola** jejího UI/UX člověkem.`
        : `**Fáze ${phase.id}: ${phase.title}** je implementovaná, ale ještě neuzavřená — projdi její UI/UX s člověkem **dřív, než ji v \`done\` zavřeš**.`;
    const bodyBlock = reportBody?.trim()
        ? `\n# Report z implementace\n${reportBody.trim()}\n`
        : '';
    let verifyBlock;
    if (verify.length > 0) {
        const lines = verify.map((v, i) => {
            const detail = v.detail ? `\n     ${v.detail}` : '';
            return `  ${i + 1}. ${v.title}${detail}`;
        });
        verifyBlock = `\n# Body z reportu k ověření\nClaude tyhle věci sám neověřil — tvoř z nich kostru kontroly:\n${lines.join('\n')}\n`;
    }
    else {
        verifyBlock = `\n# Body z reportu k ověření\nReport žádné explicitní verify body neuvádí — kontrolu veď podle cíle fáze a kroků níže.\n`;
    }
    const stepsBlock = phase.steps && phase.steps.length > 0
        ? `\n# Kroky fáze\n${phase.steps
            .map((s) => `  - ${s.title}${s.detail ? `\n    ${s.detail}` : ''}`)
            .join('\n')}\n`
        : '';
    // Kam zapsat nálezy. Hlavní cíl je run report — `mini done` z něj skládá
    // paměť, takže přes report se nálezy dostanou i tam. U rozdělané fáze stačí
    // report. U už uzavřené fáze je paměť hotová, proto nálezy přidej i do ní.
    const reportWrite = reportExists
        ? `přes \`Read\` + \`Edit\` přidej na konec \`${reportRel}\` sekci \`## Nálezy z verify\` (datum + odrážky: co je OK, co se má opravit a jak). Tahle sekce je **pod** YAML hlavičkou reportu, takže parser ani \`mini done\` nerozhodí`
        : `report \`${reportRel}\` zatím neexistuje — založ ho přes \`Write\` aspoň se sekcí \`## Nálezy z verify\` (datum + odrážky), ať nálezy nezůstanou jen v chatu`;
    const memoryWrite = phaseDone
        ? `\n   Fáze je **už uzavřená**, takže paměť \`${memoryRel}\` je hotová a report už do ní \`mini done\` zpětně nepřevezme — přidej tytéž nálezy i na konec paměťového souboru (sekce \`## Nálezy z verify\`). Pozn.: soubor může mít číselný sufix (\`-2\` apod.), když fáze prošla \`done\` víckrát — uprav ten nejnovější.`
        : '';
    return `Jsi v Claude Code session — krok **verify** workflow mini.
${frame}

# Tvůj úkol
Proveď člověka **hloubkovou kontrolou UI/UX** téhle fáze. Nejsi tu od strojových testů (ty patří do \`do\`), ale od věcí, co posoudí jen člověk: vizuální podoba, srozumitelnost, plynulost UX flow, drobné detaily a celkový dojem. Postupuj interaktivně — **ptej se po jednom**, nech člověka reagovat a teprve pak pokračuj:

1. **Připrav scénu.** Z cíle fáze, kroků a reportu níže urči, co konkrétně se má kontrolovat a jak to člověk uvidí (který příkaz/obrazovku/výstup má spustit). Když je potřeba něco nastartovat (build, dev server, ukázkový vstup), navrhni přesné kroky.
2. **Projdi verify body.** Vezmi body z reportu jako kostru a u každého nech člověka potvrdit, že to vypadá a chová se správně. Aktivně se ptej na detaily, ne jen „funguje to?".
3. **Rozšiř kontrolu.** Doplň širší UX procházku za rámec verify bodů: okrajové stavy, chybové hlášky, konzistence s okolím, přístupnost/čitelnost, drobné nepřesnosti. Navrhuj konkrétní věci k vyzkoušení.
4. **Posbírej a zapiš nálezy.** Shrň, co je v pořádku a co ne. U každého problému zachyť, co se má opravit. Pak nálezy **zapiš**: ${reportWrite}.${memoryWrite}
${bodyBlock}${verifyBlock}${stepsBlock}
# Po kontrole
- Když je vše v pořádku → řekni to (nálezy v reportu to potvrdí) a doporuč pokračovat na \`/mini:done\` (uzavření fáze), pokud ještě není uzavřená.
- Když člověk najde problémy → shrň je jako konkrétní úkoly (jsou už zapsané v reportu) a doporuč vrátit se k \`/mini:do\` a opravit je (fázi nezavírej).

Jediné, co tu zapisuješ, jsou **nálezy** (do run reportu, u uzavřené fáze i do paměti) — stav fáze v \`.mini/state.json\` **neposouváš**, to je práce \`done\`.
`;
}
