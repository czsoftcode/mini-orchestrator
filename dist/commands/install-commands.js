import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { log } from '../ui/log.js';
/** Cílový adresář pro nativní slash commandy (relativně k projektu). */
export const COMMANDS_DIR = join('.claude', 'commands', 'mini');
/**
 * Definice commandů. Tělo workflow commandů je záměrně tenké: jen pustí
 * `mini context <name>` a předá řízení vypsanému promptu. Veškerá logika a
 * aktuální kontext žijí v mini (TS), ne ve zmraženém markdownu. Read-only
 * commandy (`status`) mají vlastní `body` a žádný `mini context` nevolají.
 */
const COMMAND_DEFS = [
    {
        name: 'init',
        description: 'mini — založ nový projekt (otázky proběhnou v session)',
        body: `Tohle je krok **init** workflow mini, spuštěný přímo v Claude Code. Založíš nový mini projekt v aktuálním adresáři. Stav v \`.mini/\` vznikne příkazem \`mini init --apply …\` — nikdy nezapisuj \`.mini/state.json\` ani \`.mini/project.md\` ručně.

Postupuj v tomhle pořadí:

1. **Zeptej se uživatele** na čtyři věci (krátké odpovědi, v chatu):
   - **název projektu** (když nic neřekne, nech default = název adresáře),
   - **co staví** (1-2 věty),
   - **pro koho to je** (cílový uživatel),
   - **hlavní omezení** (jazyk/framework/deadline — může nechat prázdné).
2. **Ulož projekt.** Spusť v Bash:
   \`mini init --apply --name "<název>" --what "<co>" --for-whom "<pro koho>" --constraints "<omezení>"\`
   (\`--name\` a \`--constraints\` můžeš vynechat, když je uživatel nechal prázdné). Když příkaz ohlásí, že projekt už existuje, a uživatel **potvrdí** přepsání (stará historie fází se ztratí), zopakuj příkaz s \`--force\`. Bez potvrzení se zastav.
3. **Nabídni další kroky.** Z výstupu příkazu poznáš, jestli je v adresáři už nějaký kód (brownfield):
   - **je tam kód** → nabídni uživateli \`/mini:map\` (graf projektu) a po něm \`/mini:audit\` (přehled codebase do \`.mini/codebase.md\`),
   - **prázdný adresář** → nabídni \`/mini:next\` (navrhnout první fázi).

Výstup příkazu a doporučené další kroky stručně předej uživateli v chatu.`,
    },
    {
        name: 'next',
        description: 'mini — navrhni a ulož další fázi projektu',
        argumentHint: '[volitelný nápad na fázi]',
        contextArgs: '$ARGUMENTS',
    },
    {
        name: 'discuss',
        description: 'mini — prodiskutuj aktuální fázi před plánováním',
    },
    {
        name: 'plan',
        description: 'mini — rozmen aktuální fázi na konkrétní kroky',
    },
    {
        name: 'do',
        description: 'mini — implementuj aktuální fázi a zapiš report',
        body: `Tohle je krok **do** workflow mini, spuštěný přímo v Claude Code. Implementuješ aktuální fázi a na konci zapíšeš report. Stav v \`.mini/\` měň jen příkazy \`mini ... --apply\`, nikdy needituj \`.mini/state.json\` ručně.

Postupuj v tomhle pořadí:

1. **Nastartuj fázi.** Spusť v Bash \`mini do --apply\` — fázi to označí jako rozdělanou (\`doing\`) a založí \`.mini/run/\`, aby měl průběžný zápis kroků i report kam směřovat. Spusť to **dřív**, než začneš implementovat.
2. **Načti prompt.** Spusť \`mini context do\` a řiď se vypsanými instrukcemi (kontext projektu, kroky, formát reportu).
3. **Implementuj.** Po každém dokončeném kroku ho **hned** označ za hotový: \`mini do --apply --step-done "<přesný název kroku>"\` (název kopíruj znak po znaku ze sekce „Kroky" v promptu).
4. **Zapiš report.** Na konci přes Write tool ulož report do \`.mini/run/phase-{id}.md\` přesně podle formátu z promptu (YAML statusy + volný text). Teprve potom skonči.

Když některý krok narazí na blocker, který sám neumíš obejít, zastav se a předej řízení uživateli.`,
    },
    {
        name: 'done',
        description: 'mini — lidská verifikace a posun stavu fáze',
    },
    {
        name: 'verify',
        description: 'mini — hloubková UI/UX kontrola fáze člověkem',
    },
    {
        name: 'status',
        description: 'mini — přehled fází projektu (read-only)',
        body: `Tohle je krok **status** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash \`mini status\` a jeho výstup (přehled fází projektu) předej uživateli v chatu. Je to **read-only** krok — žádný stav v \`.mini/\` neměň a nic neukládej.`,
    },
    {
        name: 'map',
        description: 'mini — přegeneruj graf projektu (doplněk)',
        body: `Tohle je krok **map** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash \`mini map\` — přegeneruje graf projektu (\`.mini/graph/\` + index \`.mini/graph.json\`) ze zdrojáků. Výsledek (cestu indexu a počet zmapovaných souborů) z výstupu předej uživateli v chatu. Stav fází v \`.mini/state.json\` to nijak nemění — graf je jen derivace ze zdrojáků.`,
    },
    {
        name: 'audit',
        description: 'mini — přehled existující codebase do .mini/codebase.md (doplněk)',
        body: `Tohle je krok **audit** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash \`mini audit\` — projde existující kód a vytvoří/aktualizuje \`.mini/codebase.md\` (přehled codebase pro pozdější session). Po dokončení stručně shrň výsledek uživateli v chatu. Stav fází v \`.mini/state.json\` to nijak nemění — typicky se pouští hned po \`/mini:init\` v existujícím projektu, klidně po \`/mini:map\`.`,
    },
    {
        name: 'auto',
        description: 'mini — autonomní režim: dotáhne víc fází za sebou',
        argumentHint: '[--max-phases N] [--yolo] [--verify] [--discuss]',
        body: `Tohle je krok **auto** workflow mini, spuštěný přímo v Claude Code. Jsi v **autonomním režimu**: v cyklu sám dotahuješ celé fáze (next → discuss(podmíněně) → plan → do → verify(podmíněně) → done) a po dokončení jedné fáze plynule pokračuješ další, dokud nenarazíš na některou z hranic běhu (viz „Konec běhu"). Stav v \`.mini/\` měň jen příkazy \`mini ... --apply\`, nikdy needituj \`.mini/state.json\` ručně.

## Argumenty běhu
Uživatel spustil příkaz s argumenty: \`$ARGUMENTS\`. Vyparsuj z nich (tolerantně, na pořadí nezáleží):
- **\`--max-phases N\`** — kolik fází nejvýš dotáhnout za sebou. Když chybí (nebo nejde přečíst), použij **default 1**.
- **\`--yolo\`** — plně bezobslužný režim (viz „Potvrzování příkazů"). Když chybí, běž v normálním režimu.
- **\`--verify\`** — vynutí krok **verify** (hloubková UI/UX kontrola člověkem) v **každé** fázi běhu, i kdyby ti nepřišla jako UI/UX. Bez něj verify spouštíš jen podmíněně (viz krok 5 cyklu).
- **\`--discuss\`** — vynutí krok **discuss** v **každé** fázi běhu, i kdyby ti přišla přímočará. Bez něj discuss spouštíš jen podmíněně (viz krok 2 cyklu).

Na začátku uživateli **jednou** krátce oznam, kolik fází poběžíš a které z přepínačů \`--yolo\` / \`--verify\` / \`--discuss\` jsou zapnuté.

## Cyklus jedné fáze
Pro každou fázi projdi tyto kroky po sobě (další spusť až po dokončení předchozího):

1. **next (zastav se a zeptej).** Pokud zrovna **není** rozdělaná žádná fáze (po předchozím \`done\`, nebo na začátku, když je poslední fáze hotová), navrhni další. Spusť \`mini context next\` a řiď se promptem, ale **napřed se zastav a vezmi od uživatele nápad/podklad** na další fázi (autonomní režim fáze nevymýšlí naslepo). Když \`mini context next\` / tvůj návrh dojde k závěru, že **projekt je hotový** (TITLE: -), cyklus čistě ukonči (viz „Konec běhu"). Je-li už fáze rozdělaná (\`proposed\`/\`planned\`/\`doing\`), tenhle krok přeskoč.
2. **discuss (podmíněně / vynuceně, zastav se a zeptej).** Spusť \`mini context discuss\`, když je fáze složitá na rozhodnutí (nejednoznačný cíl, víc směrů, potřeba něco vyjasnit) **a** diskuse pro ni ještě neproběhla, **nebo** vždy, když běh dostal \`--discuss\`; pak interaktivně seber vstup od uživatele a ulož poznámky. U přímočaré fáze bez \`--discuss\` krok **přeskoč**.
3. **plan.** Spusť \`mini context plan\` a rozmen fázi na kroky; ulož přes \`mini plan --apply\`. Když už fáze kroky má, přeskoč.
4. **do (tiše).** Spusť \`mini do --apply\` a pak \`mini context do\`; implementuj fázi podle instrukcí. **Nevypisuj editační výpisy** — nepřevyprávěj každou změnu souboru do chatu, jen krátce hlas postup po krocích. Po každém hotovém kroku ho označ: \`mini do --apply --step-done "<přesný název>"\`. Na konci zapiš report do \`.mini/run/phase-{id}.md\`.
5. **verify (podmíněně, zastav se a nech ověřit).** Tenhle krok spusť, když je fáze **UI/UX povahy** — má viditelný výstup, který posoudí jen člověk (vzhled, CLI/obrazovka, UX flow, srozumitelnost); posuď to z cíle fáze, kroků a reportu. **Nebo** ho spusť vždy, když běh dostal \`--verify\`. U čistě vnitřní fáze (refaktor, parser, build, testy bez viditelného výstupu) a bez \`--verify\` verify **přeskoč**. Když běží: nech report z \`do\` zapsaný, spusť \`mini context verify\` a veď člověka hloubkovou UI/UX kontrolou podle promptu (ptej se po jednom). Nálezy se zapíšou do reportu (prompt tě navede), takže se přes report dostanou i do paměti. **Najdou-li se problémy, fázi nezavírej** — vrať se do \`do\`, oprav je ještě v téhle fázi, report aktualizuj a teprve pak pokračuj na \`done\`. Verify je řízený člověkem — **auto ho neobchází**.
6. **done.** Spusť \`mini context done\` a posuň stav; finální uložení \`mini done --apply\`. U **bodů k ručnímu ověření (verify)** se **zastav a nech uživatele ověřit** — auto verify neobchází.

Mezi kroky i mezi fázemi uživateli krátce hlas, kam ses dostal (bez zaplavení chatu).

## Potvrzování příkazů
V **normálním** režimu necháváš potvrzování bash příkazů na uživateli (řídí ho permission mode session, příp. allowlist v \`.claude/settings.json\`). V režimu **\`--yolo\`** nemáš uživatele zatěžovat dotazy — to ale funguje jen tehdy, když session **běží v acceptEdits** (spusť Claude Code s \`--permission-mode acceptEdits\`, nebo to v session přepni). Slash command sám potvrzování nevypne. Když \`--yolo\` dostaneš, ale session v acceptEdits není, jednou na to upozorni a pokračuj normálně.

## Stop háčky (kooperativní zastavení)
Na těchto **kontrolních bodech** ověř, jestli nemáš čistě skončit (když existuje soubor \`.mini/STOP\`, dokonči rozdělaný krok, zapiš report a skonči s hlášením „Zastaveno na žádost"; jinak pokračuj). Signál zakládá uživatel z druhého terminálu příkazem \`mini stop\` (zruší ho \`mini stop --clear\`) — ty soubor jen čteš na těchto bodech:
- **mezi kroky cyklu** — před každým dalším \`mini context …\` voláním,
- **po každém hotovém kroku v \`do\`** — hned po \`mini do --apply --step-done "…"\`.
(Hranice celé fáze je v tom automaticky obsažená.) Stop je nutně kooperativní — zprávu napsanou do téhle session bys během práce stejně nepřečetl; tvrdé přerušení uprostřed kroku je na Esc/Ctrl+C.

## Konec běhu
Cyklus ukonči (a krátce shrň, co se stalo), když nastane kterákoli z hranic:
- dotáhl jsi **\`--max-phases\`** fází,
- \`next\` usoudil, že **projekt je hotový**,
- narazíš na **blocker**, který sám neumíš obejít — zastav se a předej řízení uživateli (zbytek nedotahuj na sílu),
- zafungoval **stop háček**.`,
    },
];
/** Vyrenderuje obsah jednoho .md commandu. */
export function renderCommandMd(def) {
    const front = [`description: ${def.description}`];
    if (def.argumentHint) {
        front.push(`argument-hint: ${def.argumentHint}`);
    }
    const contextCall = def.contextArgs
        ? `mini context ${def.name} ${def.contextArgs}`
        : `mini context ${def.name}`;
    const body = def.body ??
        `Tohle je krok **${def.name}** workflow mini, spuštěný přímo v Claude Code.

Spusť v Bash \`${contextCall}\` a postupuj **přesně** podle vypsaných instrukcí. Prompt obsahuje aktuální kontext projektu i to, jak na konci uložit stav (přes \`mini ... --apply\`). Stav v \`.mini/\` měň jen těmi příkazy — nikdy needituj \`.mini/state.json\` ručně.`;
    return `---
${front.join('\n')}
---

${body}
`;
}
/**
 * `mini install-commands` — vygeneruje `.claude/commands/mini/*.md` do aktuálního
 * projektu. Idempotentní: lze pustit opakovaně, přepíše jen to, co se liší, a
 * vypíše, co vzniklo / aktualizovalo se / zůstalo beze změny. S `dryRun` jen
 * spočítá a vypíše, co by se stalo, ale na disk nesáhne.
 */
export async function installCommands(cwd = process.cwd(), { dryRun = false } = {}) {
    const targetDir = join(cwd, COMMANDS_DIR);
    if (!dryRun) {
        await mkdir(targetDir, { recursive: true });
    }
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const def of COMMAND_DEFS) {
        const path = join(targetDir, `${def.name}.md`);
        const content = renderCommandMd(def);
        let old = null;
        try {
            old = await readFile(path, 'utf-8');
        }
        catch {
            old = null;
        }
        if (old === content) {
            unchanged++;
            continue;
        }
        if (!dryRun) {
            const tmp = `${path}.tmp`;
            await writeFile(tmp, content, 'utf-8');
            await rename(tmp, path);
        }
        const rel = join(COMMANDS_DIR, `${def.name}.md`);
        if (old === null) {
            created++;
            log.success(dryRun ? `Vznikne: ${rel}` : `Vytvořeno: ${rel}`);
        }
        else {
            updated++;
            log.success(dryRun ? `Změní se: ${rel}` : `Aktualizováno: ${rel}`);
        }
    }
    if (unchanged > 0) {
        log.dim(`${unchanged} ${unchanged === 1 ? 'command beze změny' : 'commandů beze změny'}.`);
    }
    const total = created + updated + unchanged;
    log.success(`Hotovo — ${total} commandů v ${COMMANDS_DIR}/ (${created} nových, ${updated} změněných).`);
    log.hint('Použij je v Claude Code: /mini:init, /mini:next, /mini:discuss, /mini:plan, /mini:do, /mini:done, /mini:auto, /mini:status, /mini:map, /mini:audit');
    return { created, updated, unchanged };
}
