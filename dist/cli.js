#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { readPackageVersion } from './version.js';
const program = new Command();
function parseMaxTurns(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
        throw new InvalidArgumentError('Musí to být celé kladné číslo (např. 5).');
    }
    return n;
}
function parseBumpLevel(value) {
    if (value !== 'patch' && value !== 'minor' && value !== 'major' && value !== 'none') {
        throw new InvalidArgumentError('Musí být none, patch, minor nebo major.');
    }
    return value;
}
/**
 * `--push` je vydání, takže vyžaduje explicitní úroveň verze. Default `none`
 * (ani `--bump none`) s pushem nedává smysl — neměli bychom co otagovat. Hlášku
 * vypíšeme a ukončíme proces.
 */
function ensurePushHasBump(bump, push) {
    if (push && (bump === undefined || bump === 'none')) {
        console.error('Při --push musíš zvolit úroveň verze: --bump patch | minor | major.');
        process.exit(1);
    }
}
/** Sběrač pro opakovatelný `--file` u příkazu `map`. */
function collectFile(value, previous) {
    return [...previous, value];
}
/**
 * Vytáhne cestu editovaného souboru z hook JSON na stdin (PostToolUse Edit/Write).
 * Payload má tvar `{ tool_input: { file_path: "…" } }`. Cokoli nečitelného nebo
 * bez cesty → `null` (hook pak tiše no-opuje, nikdy neblokuje).
 */
async function readHookFilePath() {
    let raw;
    try {
        raw = await readStdin();
    }
    catch {
        return null;
    }
    try {
        const payload = JSON.parse(raw);
        const p = payload?.tool_input?.file_path;
        return typeof p === 'string' && p.length > 0 ? p : null;
    }
    catch {
        return null;
    }
}
/** Přečte celý stdin do řetězce. Pro neinteraktivní `--apply` příkazy. */
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}
function requireOption(value, flag) {
    const v = (value ?? '').trim();
    if (v.length === 0) {
        console.error(`Chybí povinný parametr ${flag}.`);
        process.exit(1);
    }
    return v;
}
program
    .name('mini')
    .description('Mini orchestrátor nad Claude Code — drží stav projektu a posílá Claudovi jen to nejnutnější.')
    .version(readPackageVersion());
program
    .command('init')
    .description('Založí nový projekt v aktuálním adresáři.')
    .option('--apply', 'Neinteraktivně založ projekt z flagů (bez otázek). Pro /mini:init.')
    .option('--name <name>', 'Název projektu (s --apply; default název adresáře).')
    .option('--what <what>', 'Co stavíš (s --apply).')
    .option('--for-whom <forWhom>', 'Pro koho to je (s --apply).')
    .option('--constraints <constraints>', 'Hlavní omezení (s --apply; volitelné).')
    .option('--force', 'Přepiš existující projekt bez ptaní (s --apply).')
    .action(async (opts) => {
    if (opts.apply) {
        const what = requireOption(opts.what, '--what');
        const forWhom = requireOption(opts.forWhom, '--for-whom');
        const { applyInit } = await import('./commands/init.js');
        const r = await applyInit({
            name: opts.name,
            what,
            forWhom,
            constraints: opts.constraints,
            force: opts.force,
        });
        if (!r.ok)
            process.exit(1);
        return;
    }
    const { init } = await import('./commands/init.js');
    await init();
});
program
    .command('next')
    .description('Navrhne, co by mělo přijít jako další fáze.')
    .option('--apply', 'Neinteraktivně ulož fázi z --title/--goal (bez Claude). Pro /mini:next.')
    .option('--title <title>', 'Název nové fáze (s --apply).')
    .option('--goal <goal>', 'Cíl nové fáze (s --apply).')
    .action(async (opts) => {
    if (opts.apply) {
        const title = requireOption(opts.title, '--title');
        const goal = requireOption(opts.goal, '--goal');
        const { applyNewPhase } = await import('./commands/next.js');
        const r = await applyNewPhase(title, goal);
        if (!r.ok)
            process.exit(1);
        return;
    }
    const { next } = await import('./commands/next.js');
    await next();
});
program
    .command('plan')
    .description('Rozmění aktuální fázi na konkrétní kroky.')
    .option('--apply', 'Neinteraktivně ulož kroky čtené ze stdin (jeden na řádek `title :: detail`, detail volitelný, bez Claude). Pro /mini:plan.')
    .action(async (opts) => {
    if (opts.apply) {
        const { applyPlanSteps, parseStepsFromStdin } = await import('./commands/plan.js');
        const steps = parseStepsFromStdin(await readStdin());
        const r = await applyPlanSteps(steps);
        if (!r.ok)
            process.exit(1);
        return;
    }
    const { plan } = await import('./commands/plan.js');
    await plan();
});
program
    .command('do')
    .description('Spustí Claude Code na aktuální fázi nebo kroku.')
    .option('--stream', 'Spustit Claude v neinteraktivním print-módu se streamovaným JSON výstupem (průběžně zobrazí aktuální akci, na konci shrne cenu a tokeny).')
    .option('--max-turns <n>', 'Maximální počet odpovědí Claude Code v session — po N odpovědích se session automaticky zastaví (šetří tokeny).', parseMaxTurns)
    .option('--apply', 'Neinteraktivně označ fázi jako rozdělanou a založ .mini/run/ (bez Claude). Pro /mini:do.')
    .option('--step-done <title>', 'S --apply: označ jeden krok aktuální fáze za hotový (průběžný zápis během /mini:do).')
    .action(async (opts) => {
    if (opts.apply) {
        if (opts.stepDone !== undefined) {
            const { applyStepDone } = await import('./commands/do.js');
            const r = await applyStepDone(opts.stepDone);
            if (!r.ok)
                process.exit(1);
            return;
        }
        const { applyDoStart } = await import('./commands/do.js');
        const r = await applyDoStart();
        if (!r.ok)
            process.exit(1);
        return;
    }
    const { doPhase } = await import('./commands/do.js');
    await doPhase({ stream: opts.stream, maxTurns: opts.maxTurns });
});
program
    .command('done')
    .description('Lidská verifikace — zeptá se, jestli to funguje, a posune stav.')
    .option('--apply', 'Neinteraktivně posuň stav podle reportu (bez dotazů). Pro /mini:done.')
    .option('--accept-verify', 'S --apply: body k ručnímu ověření ber jako odsouhlasené (verifikace proběhla v chatu).')
    .option('--bump <level>', 'Úroveň navýšení verze v package.json při uzavření fáze: none | patch | minor | major (default none — verzi nenavyšovat). Při --push je povinný patch | minor | major.', parseBumpLevel)
    .option('--push', 'Po commitu fáze pushnout na remote (git push). Vyžaduje --bump patch | minor | major.')
    .action(async (opts) => {
    ensurePushHasBump(opts.bump, opts.push);
    if (opts.apply) {
        const { applyDone } = await import('./commands/done.js');
        const r = await applyDone(process.cwd(), {
            acceptVerify: opts.acceptVerify,
            bump: opts.bump,
            push: opts.push,
        });
        if (!r.ok)
            process.exit(1);
        return;
    }
    const { done } = await import('./commands/done.js');
    await done({ bump: opts.bump, push: opts.push });
});
program
    .command('auto')
    .description('Auto chain: next → plan → (do → done){pro každý krok}. Fázi dotáhne sám, ale u bodů k ručnímu ověření (verify) se zastaví a zeptá člověka — není to plně bezobslužný běh.')
    .option('--max-turns <n>', 'Maximální počet odpovědí Claude Code v každé session — po N odpovědích se session automaticky zastaví (šetří tokeny).', parseMaxTurns)
    .option('--bump <level>', 'Úroveň navýšení verze v package.json při uzavření fáze: none | patch | minor | major (default none — verzi nenavyšovat). Při --push je povinný patch | minor | major.', parseBumpLevel)
    .option('--push', 'Po commitu fáze pushnout na remote (git push). Vyžaduje --bump patch | minor | major.')
    .action(async (opts) => {
    ensurePushHasBump(opts.bump, opts.push);
    const { auto } = await import('./commands/auto.js');
    await auto({ maxTurns: opts.maxTurns, bump: opts.bump, push: opts.push });
});
program
    .command('discuss')
    .description('Otevře interaktivní session Claude Code zaměřenou na aktuální fázi — lze prodiskutovat záměr před plánováním.')
    .action(async () => {
    const { discuss } = await import('./commands/discuss.js');
    await discuss();
});
program
    .command('undo')
    .description('Vrátí poslední změnu stavu o krok zpět.')
    .action(async () => {
    const { undo } = await import('./commands/undo.js');
    await undo();
});
program
    .command('status')
    .description('Ukáže, kde se v projektu právě nacházíme.')
    .action(async () => {
    const { status } = await import('./commands/status.js');
    await status();
});
program
    .command('stop')
    .description('Založí kooperativní stop signál (.mini/STOP) — autonomní /mini:auto dokončí rozdělaný krok a čistě skončí. S --clear signál smaže.')
    .option('--clear', 'Smaže stop signál místo jeho založení.')
    .action(async (opts) => {
    const { stop } = await import('./commands/stop.js');
    await stop({ clear: opts.clear });
});
program
    .command('import-gsd')
    .description('Jednorázový import rozdělaného GSD projektu z .planning/.')
    .action(async () => {
    const { importGsd } = await import('./commands/import-gsd.js');
    await importGsd();
});
program
    .command('migrate')
    .description('Převede starý monolitický state.json (verze 1) na nový layout (.mini/phases/ + hlavička). Idempotentní — na už zmigrovaném stavu nedělá nic.')
    .option('--renumber', 'Přečísluj fáze na souvislá celá čísla (1..N podle pořadí ve state.json) a sjednoť názvy souborů ve phases/discuss/run/memory na phase-XXX. Idempotentní.')
    .option('--dry-run', 'S --renumber: jen vypiš náhled mapování a přejmenování, nic nezapisuj.')
    .action(async (opts) => {
    if (opts.renumber) {
        const { renumber } = await import('./commands/renumber.js');
        const confirm = async () => {
            const { ask } = await import('./ui/ask.js');
            const res = await ask({
                type: 'confirm',
                name: 'ok',
                message: 'Provést přečíslování a přejmenování souborů?',
                initial: false,
            });
            return res.ok === true;
        };
        const r = await renumber(process.cwd(), { dryRun: opts.dryRun, confirm: opts.dryRun ? undefined : confirm });
        if (!r.ok)
            process.exit(1);
        return;
    }
    const { migrate } = await import('./commands/migrate.js');
    const r = await migrate();
    if (!r.ok)
        process.exit(1);
});
program
    .command('audit')
    .description('Projde existující kód a vytvoří/aktualizuje .mini/codebase.md (přehled pro pozdější Claude session).')
    .action(async () => {
    const { audit } = await import('./commands/audit.js');
    await audit();
});
program
    .command('map')
    .description('Přegeneruje strojovou mapu projektu do .mini/graph/ + index .mini/graph.json — exporty, importy a signatury TS/PHP/Rust/Python/Go/Java/C#/Kotlin/Swift/Ruby souborů.')
    .option('--file <cesta>', 'Inkrementálně přemapuj jen daný soubor (uzel + záznam v indexu), lze opakovat. Bez tohoto flagu proběhne plný rebuild.', collectFile, [])
    .option('--hook', 'Přečti cestu editovaného souboru z hook JSON na stdin (PostToolUse Edit/Write) a inkrementálně ji přemapuj. Tiše no-opuje, když payload cestu nemá.')
    .action(async (opts) => {
    const { map } = await import('./commands/map.js');
    if (opts.hook) {
        const fromHook = await readHookFilePath();
        // Žádná cesta (jiný tool / nečitelný payload) → tiché no-op, ne plný rebuild.
        if (!fromHook)
            return;
        await map([...opts.file, fromHook]);
        return;
    }
    await map(opts.file.length > 0 ? opts.file : undefined);
});
program
    .command('context <cmd> [args...]')
    .description('Vypíše na stdout aktuální session prompt pro daný krok (next|discuss|plan|do|done). Slouží nativním /mini: slash commandům v Claude Code.')
    .action(async (cmd, args) => {
    const { context } = await import('./commands/context.js');
    await context(cmd, args);
});
program
    .command('update')
    .description('Srovná negenerovanou část projektu na aktuální verzi mini: statický skeleton .mini/ (adresáře + .gitignore) a slash commandy .claude/commands/mini/*.md. Idempotentní — vytvoří chybějící, přepíše změněné, ostatní nechá.')
    .option('--dry-run', 'Jen náhled — vypiš, co by se vytvořilo/změnilo, ale nic nezapisuj.')
    .action(async (opts) => {
    const { update } = await import('./commands/update.js');
    const r = await update(process.cwd(), { dryRun: opts.dryRun });
    if (!r.ok)
        process.exit(1);
});
program
    .command('install-commands')
    .description('Vygeneruje .claude/commands/mini/*.md (slash commandy /mini:*) do aktuálního projektu. Idempotentní — lze pustit opakovaně.')
    .action(async () => {
    const { installCommands } = await import('./commands/install-commands.js');
    await installCommands();
});
program
    .command('model [scope] [name]')
    .description('Model pro projekt. Příklady: "mini model" (interaktivně), "mini model show", "mini model sonnet" (default), "mini model do opus", "mini model do default" (zruší override), "mini model reset".')
    .action(async (scope, name) => {
    const { model } = await import('./commands/model.js');
    await model(scope, name);
});
program.parseAsync().catch((err) => {
    console.error(err);
    process.exit(1);
});
